import { db } from './db';

export type DayMetrics = {
  date: string;       // YYYY-MM-DD in WIB
  leads: number;
  purchase: number;
  convRate: number;   // 0–1, two decimal places max
  revenue: number;    // IDR integer
  active: number;     // participants who BECAME active (startAt) on this WIB day — event count
  convRateActive: number; // active ÷ purchases of the same day
  totalWa: number;
  sukses: number;
  failed: number;
};

/**
 * Live (current-state) challenge metrics — NOT day-bucketed. A participant's
 * RUNNING status is a snapshot, not a historical per-day event, so Active is a
 * single current number scoped to the optional program filter (the KPI cards),
 * not a column we can reconstruct per past day.
 */
export type ActiveSnapshot = {
  active: number;          // participants currently RUNNING (Challenge §21)
  purchases: number;       // cumulative PAID orders in scope (denominator)
  convRateActive: number;  // active / purchases, 0–1
};

export type ReportData = {
  today: DayMetrics;
  series: DayMetrics[];
  snapshot: ActiveSnapshot;
};

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7

function toWibDateString(date: Date): string {
  const wib = new Date(date.getTime() + WIB_OFFSET_MS);
  return wib.toISOString().slice(0, 10);
}

function wibDayBounds(dateStr: string): { start: Date; end: Date } {
  const start = new Date(`${dateStr}T00:00:00.000+07:00`);
  const end = new Date(`${dateStr}T23:59:59.999+07:00`);
  return { start, end };
}

/** Conversion ratio (0–1) at 4-decimal precision; 0 when the denominator is 0.
 *  Shared by convRate (purchase/leads) and convRateActive (active/purchases). */
export function rate(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 10000) / 10000; // 4 decimal precision
}

export async function getDayMetrics(dateStr: string, productId?: string): Promise<DayMetrics> {
  const { start, end } = wibDayBounds(dateStr);

  // Optional program filter — scope every metric to one product (PRD §20.4/§20.11).
  const orderScope = productId ? { productId } : {};
  const deliveryScope = productId ? { order: { productId } } : {};

  const [leads, purchases, sukses, failed] = await Promise.all([
    db.order.count({ where: { ...orderScope, createdAt: { gte: start, lte: end } } }),
    db.order.aggregate({
      where: { ...orderScope, status: 'PAID', paidAt: { gte: start, lte: end } },
      _count: { _all: true },
      _sum: { amountIdr: true },
    }),
    // Sukses: bucket by sentAt (when the e-book was actually delivered).
    db.delivery.count({ where: { ...deliveryScope, status: 'SENT', sentAt: { gte: start, lte: end } } }),
    // Failed: terminal failures, bucketed by updatedAt (no sentAt on a failure).
    db.delivery.count({ where: { ...deliveryScope, status: 'FAILED', updatedAt: { gte: start, lte: end } } }),
  ]);

  const purchase = purchases._count._all;
  const revenue = purchases._sum.amountIdr ?? 0;

  return {
    date: dateStr,
    leads,
    purchase,
    convRate: rate(purchase, leads),
    revenue,
    active: 0,
    convRateActive: 0,
    totalWa: sukses + failed,
    sukses,
    failed,
  };
}

/**
 * Live challenge snapshot: how many participants are currently RUNNING vs. how
 * many total paid orders exist (cumulative, all-time) within the program scope.
 * Active = count of `RUNNING` ChallengeParticipant; convRateActive = active /
 * cumulative purchases. Scoped via the participant's challenge → product.
 */
export async function getActiveSnapshot(productId?: string): Promise<ActiveSnapshot> {
  const [active, purchases] = await Promise.all([
    db.challengeParticipant.count({
      where: { status: 'RUNNING', ...(productId ? { challenge: { productId } } : {}) },
    }),
    db.order.count({ where: { status: 'PAID', ...(productId ? { productId } : {}) } }),
  ]);
  return { active, purchases, convRateActive: rate(active, purchases) };
}

/**
 * Per-day **event** count of Active for the historical series — bucketed the
 * same way leads/purchase are: a participant is counted on the single WIB day
 * they *became* active (i.e. their `startAt` = initial proof received = challenge
 * day 1), NOT every day they remain RUNNING. So a day shows a number only when a
 * new participant entered Active that day (most days are 0). Conv. Rate Active
 * for the row is computed by the caller as active ÷ purchases of the same day
 * (mirroring Conv. Rate = purchase ÷ leads). Participants that never started
 * (`startAt` null) are never counted.
 * Returns a map keyed by WIB date string so getReport can merge it into series.
 */
// Pure: bucket WIB start-day strings into per-day Active event counts.
export function bucketActiveByDay(startDays: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const d of startDays) counts.set(d, (counts.get(d) ?? 0) + 1);
  return counts;
}

export async function getActiveSeries(
  dates: string[],
  productId?: string,
): Promise<Map<string, number>> {
  if (dates.length === 0) return new Map<string, number>();

  const participants = await db.challengeParticipant.findMany({
    where: { startAt: { not: null }, ...(productId ? { challenge: { productId } } : {}) },
    select: { startAt: true },
  });

  // Bucket each participant by the WIB day they became active (startAt).
  return bucketActiveByDay(participants.map(p => toWibDateString(p.startAt!)));
}

// Inclusive list of WIB date strings from `fromStr` to `toStr` (both YYYY-MM-DD).
// Anchored on the +07:00 offset and stepped by whole days so the labels are
// correct in WIB regardless of the server/container timezone (no setHours).
export function buildDateSeries(fromStr: string, toStr: string): string[] {
  const dates: string[] = [];
  let cur = new Date(`${fromStr}T00:00:00.000+07:00`);
  const end = new Date(`${toStr}T00:00:00.000+07:00`);
  while (cur <= end) {
    dates.push(toWibDateString(cur));
    cur = new Date(cur.getTime() + 24 * 60 * 60 * 1000);
  }
  return dates;
}

export async function getReport(
  fromStr: string,
  toStr: string,
  productId?: string,
): Promise<ReportData> {
  const todayStr = toWibDateString(new Date());
  const dates = buildDateSeries(fromStr, toStr);

  const [today, snapshot, activeSeries, ...seriesDates] = await Promise.all([
    getDayMetrics(todayStr, productId),
    getActiveSnapshot(productId),
    getActiveSeries(dates, productId),
    ...dates.map(d => getDayMetrics(d, productId)),
  ]);

  // Active = participants who became active that WIB day (event count, like
  // leads/purchase). Conv. Rate Active = active ÷ purchases of the same day.
  const series = seriesDates.map(m => {
    const active = activeSeries.get(m.date) ?? 0;
    return { ...m, active, convRateActive: rate(active, m.purchase) };
  });

  return { today, series, snapshot };
}
