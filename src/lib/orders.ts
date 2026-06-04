import { OrderStatus } from '@prisma/client';
import { db } from './db';

// Forward-only status transition table.
// A higher index = more final. We only advance, never regress.
const STATUS_ORDER: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.PAID,
  OrderStatus.FAILED,
  OrderStatus.EXPIRED,
  OrderStatus.CANCELLED,
  OrderStatus.REFUNDED,
];

function rank(status: OrderStatus): number {
  const idx = STATUS_ORDER.indexOf(status);
  return idx === -1 ? -1 : idx;
}

/** Returns true if transitioning from `current` to `next` is allowed (forward-only). */
export function canTransition(current: OrderStatus, next: OrderStatus): boolean {
  // PAID is terminal for delivery purposes; never regress from it.
  if (current === OrderStatus.PAID && next === OrderStatus.PENDING) return false;
  return rank(next) >= rank(current);
}

/** Idempotently advances an order's status. Returns the updated order, or null if no change. */
export async function advanceOrderStatus(
  orderId: string,
  next: OrderStatus,
  extra?: {
    midtransTransactionId?: string;
    paymentType?: string;
    paidAt?: Date;
  },
) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (!canTransition(order.status, next)) return null; // no-op: idempotent

  return db.order.update({
    where: { id: orderId },
    data: { status: next, ...extra },
  });
}

/** Generates a unique order code in the format ORD-YYYYMMDD-XXXXXXXX. */
export function generateOrderCode(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `ORD-${date}-${rand}`;
}
