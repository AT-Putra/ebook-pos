import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySignature, mapMidtransStatus } from '@/lib/midtrans';
import { advanceOrderStatus } from '@/lib/orders';
import { OrderStatus } from '@prisma/client';

export async function POST(req: NextRequest) {
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const orderId = String(payload.order_id ?? '');
  const statusCode = String(payload.status_code ?? '');
  const grossAmount = String(payload.gross_amount ?? ''); // MUST use exact string — do not reformat
  const signatureKey = String(payload.signature_key ?? '');
  const transactionStatus = String(payload.transaction_status ?? '');
  const fraudStatus = payload.fraud_status ? String(payload.fraud_status) : null;
  const transactionId = payload.transaction_id ? String(payload.transaction_id) : null;
  const paymentType = payload.payment_type ? String(payload.payment_type) : null;

  // 1. Verify signature (INVARIANT — reject on mismatch, log everything).
  const signatureValid = verifySignature({ orderId, statusCode, grossAmount, signatureKey });

  // 2. Find order — log even if signature is invalid.
  const order = await db.order.findUnique({ where: { orderCode: orderId } });

  // 3. Persist audit log (always, regardless of signature validity or order existence).
  if (order) {
    await db.paymentEvent.create({
      data: {
        orderId: order.id,
        transactionStatus,
        fraudStatus,
        statusCode,
        signatureValid,
        rawPayload: payload as object,
      },
    });
  } else {
    // Log unknown order_id to server logs — cannot persist without orderId FK.
    console.warn('[webhook] Unknown order_id:', orderId, 'payload:', JSON.stringify(payload));
  }

  if (!signatureValid) {
    console.warn('[webhook] Signature mismatch for order:', orderId);
    return NextResponse.json({ error: 'Signature mismatch.' }, { status: 403 });
  }

  if (!order) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  }

  // 4. Map status + apply idempotent forward-only transition.
  const nextStatus = mapMidtransStatus(transactionStatus, fraudStatus);
  if (nextStatus !== null) {
    const extra =
      nextStatus === OrderStatus.PAID
        ? { midtransTransactionId: transactionId ?? undefined, paymentType: paymentType ?? undefined, paidAt: new Date() }
        : { midtransTransactionId: transactionId ?? undefined, paymentType: paymentType ?? undefined };

    const updated = await advanceOrderStatus(order.id, nextStatus, extra);

    // 5. If order just became PAID, trigger delivery (fire-and-forget; webhook acks fast).
    if (updated && nextStatus === OrderStatus.PAID) {
      // Import inline to avoid circular dep; delivery.ts is built in F4.
      // For now, create the Delivery row — F4 will add the send logic.
      const existing = await db.delivery.findUnique({ where: { orderId: order.id } });
      if (!existing) {
        await db.delivery.create({
          data: { orderId: order.id },
        });
      }
    }
  }

  // 6. Always return 200 quickly (Midtrans retries on non-2xx).
  return NextResponse.json({ received: true });
}
