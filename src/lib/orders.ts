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

// ── Checkout dedup (D18, §27) ────────────────────────────────────────────────
// A repeat checkout for the SAME customer (email+whatsapp) + product reuses the existing lead
// instead of creating a duplicate, branching on its status. Pure decision → unit-tested.

export type CheckoutActionKind = 'already_paid' | 'continue' | 'renew' | 'new';

export type CheckoutDecision<T> =
  | { kind: 'already_paid'; order: T }
  | { kind: 'continue'; order: T }
  | { kind: 'renew'; order: T }
  | { kind: 'new' };

/**
 * Decides what a repeat checkout should do, given the customer's existing orders for the product
 * (newest first). Rules (owner-confirmed):
 *  - any PAID order → 'already_paid' (show the status page);
 *  - else look at the LATEST order: PENDING with a payment URL → 'continue'; PENDING without one or
 *    EXPIRED → 'renew' (new Midtrans transaction on the same lead); FAILED/CANCELLED/REFUNDED → 'new'.
 */
export function decideCheckoutAction<T extends { status: OrderStatus; snapRedirectUrl: string | null }>(
  ordersNewestFirst: T[],
): CheckoutDecision<T> {
  const paid = ordersNewestFirst.find(o => o.status === OrderStatus.PAID);
  if (paid) return { kind: 'already_paid', order: paid };

  const latest = ordersNewestFirst[0];
  if (!latest) return { kind: 'new' };
  if (latest.status === OrderStatus.PENDING) {
    return latest.snapRedirectUrl ? { kind: 'continue', order: latest } : { kind: 'renew', order: latest };
  }
  if (latest.status === OrderStatus.EXPIRED) return { kind: 'renew', order: latest };
  return { kind: 'new' }; // FAILED / CANCELLED / REFUNDED latest → fresh order
}

/** Pure: trackingId is only set when the existing value is null/empty and an incoming one is present. */
export function shouldSetTracking(existing: string | null | undefined, incoming: string | null | undefined): boolean {
  return (!existing || existing.trim() === '') && !!incoming && incoming.trim() !== '';
}

/**
 * Renews an EXPIRED/stale order for a fresh payment on the SAME lead row: assigns a NEW orderCode
 * (the old Midtrans order_id can't be reused), flips status back to PENDING, refreshes the amount,
 * and clears the old payment fields. Returns the new orderCode. Retries on code collision.
 */
export async function renewOrderForPayment(orderId: string, amountIdr: number): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const orderCode = generateOrderCode();
    try {
      await db.order.update({
        where: { id: orderId },
        data: {
          orderCode,
          status: OrderStatus.PENDING,
          amountIdr,
          midtransTransactionId: null,
          paidAt: null,
          snapToken: null,
          snapRedirectUrl: null,
        },
      });
      return orderCode;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002' && attempt < 4) continue;
      throw err;
    }
  }
  throw new Error('Could not renew the order code after retries.');
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
