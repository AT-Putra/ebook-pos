// Pure sales-window logic for "programs" (a Product extended with a sales period).
// No DB access here so it stays unit-testable (PRD §20.11, invariant #12).

export type SaleStatus = 'inactive' | 'scheduled' | 'open' | 'closed';

/** The minimal Product fields the sales window cares about. */
export type SalesWindowFields = {
  isActive: boolean;
  salesStartAt: Date | null;
  salesEndAt: Date | null;
};

/** True iff the program can be bought right now: active and within its sales window. */
export function isOnSale(p: SalesWindowFields, now: Date = new Date()): boolean {
  if (!p.isActive) return false;
  if (p.salesStartAt && now < p.salesStartAt) return false;
  if (p.salesEndAt && now > p.salesEndAt) return false;
  return true;
}

/** Human-facing status for the dashboard badge. */
export function salesStatus(p: SalesWindowFields, now: Date = new Date()): SaleStatus {
  if (!p.isActive) return 'inactive';
  if (p.salesStartAt && now < p.salesStartAt) return 'scheduled';
  if (p.salesEndAt && now > p.salesEndAt) return 'closed';
  return 'open';
}

// ── WIB (UTC+7) date <-> instant helpers ───────────────────────────────────
// The operator picks calendar dates; we store the inclusive WIB day boundaries.

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** YYYY-MM-DD (WIB) 00:00:00.000 → the matching UTC instant. */
export function wibDayStart(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000+07:00`);
}

/** YYYY-MM-DD (WIB) 23:59:59.999 → the matching UTC instant (inclusive end of day). */
export function wibDayEnd(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999+07:00`);
}

/** A Date → the YYYY-MM-DD it falls on in WIB (for pre-filling <input type="date">). */
export function toWibDateInput(date: Date | null | undefined): string {
  if (!date) return '';
  return new Date(date.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

/** Parses an optional "YYYY-MM-DD" sales-start value to a stored instant (or null). */
export function parseSalesStart(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  return wibDayStart(dateStr);
}

/** Parses an optional "YYYY-MM-DD" sales-end value to a stored instant (or null). */
export function parseSalesEnd(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  return wibDayEnd(dateStr);
}
