import { OrderStatus, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { db } from './db';

// Explicit allowed-transition map. The previous linear "rank" model wrongly let a
// PAID order be overwritten by a late/out-of-order FAILED/EXPIRED/CANCELLED
// notification. Rules:
//   - PENDING may resolve to any final state.
//   - PAID may only move to REFUNDED (a real refund); never back to a failure.
//   - Failure states and REFUNDED are terminal (a genuine late settlement after a
//     terminal failure is rare and handled manually — keeps the model forward-only).
//   - Same → same is a no-op (returns false) so duplicate notifications don't
//     re-write the row (e.g. resetting paidAt and shifting dashboard buckets).
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [
    OrderStatus.PAID,
    OrderStatus.FAILED,
    OrderStatus.EXPIRED,
    OrderStatus.CANCELLED,
    OrderStatus.REFUNDED,
  ],
  [OrderStatus.PAID]: [OrderStatus.REFUNDED],
  [OrderStatus.FAILED]: [],
  [OrderStatus.EXPIRED]: [],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.REFUNDED]: [],
};

/** Returns true if transitioning from `current` to `next` is allowed (forward-only). */
export function canTransition(current: OrderStatus, next: OrderStatus): boolean {
  if (current === next) return false; // idempotent no-op — never re-write same status
  return ALLOWED_TRANSITIONS[current].includes(next);
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

/** Generates an order code in the format ORD-YYYYMMDD-XXXXXXXX (crypto-random suffix). */
export function generateOrderCode(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = randomBytes(8);
  let suffix = '';
  for (let i = 0; i < 8; i++) suffix += alphabet[bytes[i] % alphabet.length];
  return `ORD-${date}-${suffix}`;
}

/** Creates a PENDING order, retrying on the (improbable) orderCode unique collision. */
export async function createPendingOrder(input: {
  customerId: string;
  productId: string;
  amountIdr: number;
  trackingId: string | null;
}) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await db.order.create({
        data: { orderCode: generateOrderCode(), status: OrderStatus.PENDING, ...input },
      });
    } catch (err) {
      const isUniqueCollision =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
      if (isUniqueCollision && attempt < 4) continue;
      throw err;
    }
  }
  throw new Error('Could not generate a unique order code after retries.');
}
