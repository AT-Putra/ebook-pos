// Leads menu (slice D4, §20.14). A "Lead" = any checkout submission (an `Order`, any status).
// Pure presentation helpers shared by the API export and the dashboard UI — unit-tested, no DB.

import { OrderStatus } from '@prisma/client';

/** Indonesian Rupiah, integer (no decimals — invariant #8). e.g. 100000 → "Rp 100.000". */
export function formatIdr(amount: number): string {
  return 'Rp ' + Math.round(amount).toLocaleString('id-ID');
}

export type StatusTone = { label: string; bg: string; fg: string };

/** Operator-facing label + badge colors per order status. */
export const LEAD_STATUS: Record<OrderStatus, StatusTone> = {
  PENDING: { label: 'Menunggu bayar', bg: '#fef9c3', fg: '#ca8a04' },
  PAID: { label: 'Lunas', bg: '#dcfce7', fg: '#16a34a' },
  FAILED: { label: 'Gagal', bg: '#fee2e2', fg: '#dc2626' },
  EXPIRED: { label: 'Kedaluwarsa', bg: '#f1f5f9', fg: '#64748b' },
  CANCELLED: { label: 'Dibatalkan', bg: '#f1f5f9', fg: '#64748b' },
  REFUNDED: { label: 'Dikembalikan', bg: '#ede9fe', fg: '#7c3aed' },
};

/** Safe lookup — falls back to the raw status string for any unknown value. */
export function leadStatusMeta(status: string): StatusTone {
  return LEAD_STATUS[status as OrderStatus] ?? { label: status, bg: '#f1f5f9', fg: '#64748b' };
}
