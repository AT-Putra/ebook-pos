import { db } from './db';

export type DayMetrics = {
  date: string;       // YYYY-MM-DD in WIB
  leads: number;
  purchase: number;
  convRate: number;   // 0–1, two decimal places max
  revenue: number;    // IDR integer
  active: number;     // stub — 0 until Challenge module
  convRateActive: number; // stub — 0
  totalWa: number;
  sukses: number;
  failed: number;
};

export type ReportData = {
  today: DayMetrics;
  series: DayMetrics[];
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

function rate(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 10000) / 10000; // 4 decimal precision
}

export async function getDayMetrics(dateStr: string): Promise<DayMetrics> {
  const { start, end } = wibDayBounds(dateStr);

  const [leads, purchases, sukses, failed] = await Promise.all([
    db.order.count({ where: { createdAt: { gte: start, lte: end } } }),
    db.order.aggregate({
      where: { status: 'PAID', paidAt: { gte: start, lte: end } },
      _count: { _all: true },
      _sum: { amountIdr: true },
    }),
    // Sukses: bucket by sentAt (when the e-book was actually delivered).
    db.delivery.count({ where: { status: 'SENT', sentAt: { gte: start, lte: end } } }),
    // Failed: terminal failures, bucketed by updatedAt (no sentAt on a failure).
    db.delivery.count({ where: { status: 'FAILED', updatedAt: { gte: start, lte: end } } }),
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

export async function getReport(fromStr: string, toStr: string): Promise<ReportData> {
  const todayStr = toWibDateString(new Date());

  const [today, ...seriesDates] = await Promise.all([
    getDayMetrics(todayStr),
    ...buildDateSeries(fromStr, toStr).map(d => getDayMetrics(d)),
  ]);

  return { today, series: seriesDates };
}
