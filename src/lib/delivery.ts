import { DeliveryStatus } from '@prisma/client';
import { db } from './db';
import { readEbookAsBase64 } from './files';
import { sendFile } from './waha';
import { toChatId } from './phone';

export const BACKOFF_MINUTES = [1, 5, 15, 60, 360]; // exponential backoff schedule

// How long a delivery may sit in PROCESSING before it's considered orphaned
// (e.g. the process crashed mid-send) and reclaimed for retry by the cron.
const STALE_PROCESSING_MINUTES = 10;

/** Delay before the next retry, given how many attempts have now been made.
 *  attemptsSoFar=1 → first retry uses BACKOFF_MINUTES[0]. */
function nextRetryAt(attemptsSoFar: number): Date | null {
  const minutes = BACKOFF_MINUTES[attemptsSoFar - 1];
  if (minutes === undefined) return null; // schedule exhausted
  const d = new Date();
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

/**
 * Attempts to send an e-book delivery.
 * Exactly-once: atomically claims the row (PENDING/FAILED → PROCESSING) so two
 * concurrent callers can't both send. A SENT or already-PROCESSING row is skipped.
 */
export async function attemptDelivery(deliveryId: string): Promise<void> {
  // Atomic claim — only one caller can move PENDING/FAILED → PROCESSING.
  // Replaces the previous read-then-write check, which had a TOCTOU race that
  // could let duplicate webhooks double-send the e-book (invariant #3).
  const claim = await db.delivery.updateMany({
    where: { id: deliveryId, status: { in: [DeliveryStatus.PENDING, DeliveryStatus.FAILED] } },
    data: { status: DeliveryStatus.PROCESSING },
  });
  if (claim.count === 0) return; // already SENT/PROCESSING, or row not found

  const delivery = await db.delivery.findUniqueOrThrow({
    where: { id: deliveryId },
    include: {
      order: {
        include: {
          customer: true,
          product: true,
        },
      },
    },
  });

  const { order } = delivery;
  const { customer, product } = order;

  try {
    const base64Data = await readEbookAsBase64(product.filePath);
    const chatId = toChatId(customer.whatsapp);

    const result = await sendFile({
      chatId,
      mimeType: product.mimeType,
      filename: product.fileName,
      base64Data,
      caption: `Terima kasih atas pembelianmu, ${customer.name}! 🎉 Berikut e-book kamu: *${product.name}*`,
    });

    await db.delivery.update({
      where: { id: deliveryId },
      data: {
        status: DeliveryStatus.SENT,
        wahaMessageId: result.id,
        sentAt: new Date(),
        attempts: { increment: 1 },
        lastError: null,
      },
    });
  } catch (err) {
    const newAttempts = delivery.attempts + 1;
    const isTerminal = newAttempts >= delivery.maxAttempts;
    const retryAt = isTerminal ? null : nextRetryAt(newAttempts);

    await db.delivery.update({
      where: { id: deliveryId },
      data: {
        status: isTerminal ? DeliveryStatus.FAILED : DeliveryStatus.PENDING,
        attempts: { increment: 1 },
        lastError: err instanceof Error ? err.message : String(err),
        nextRetryAt: retryAt,
      },
    });

    if (isTerminal) {
      console.error(
        `[delivery] Terminal failure for delivery ${deliveryId} (order ${order.orderCode}):`,
        err,
      );
    }
  }
}

/** Picks up all due PENDING/FAILED deliveries and attempts them.
 *  Returns a summary { processed, sent, failed }. */
export async function processDueDeliveries(): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  const now = new Date();

  // Reclaim deliveries orphaned in PROCESSING (e.g. the process crashed mid-send):
  // the atomic claim only moves PENDING/FAILED, so without this they'd never retry.
  const staleBefore = new Date(now.getTime() - STALE_PROCESSING_MINUTES * 60_000);
  await db.delivery.updateMany({
    where: { status: DeliveryStatus.PROCESSING, updatedAt: { lt: staleBefore } },
    data: { status: DeliveryStatus.PENDING },
  });

  // Prisma can't compare two columns in one filter; fetch candidates then filter in JS.
  const candidates = await db.delivery.findMany({
    where: {
      status: { in: [DeliveryStatus.PENDING, DeliveryStatus.FAILED] },
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
    },
  });

  const eligibleDeliveries = candidates.filter(d => d.attempts < d.maxAttempts);

  let sent = 0;
  let failed = 0;

  for (const d of eligibleDeliveries) {
    await attemptDelivery(d.id);

    const updated = await db.delivery.findUniqueOrThrow({ where: { id: d.id } });
    if (updated.status === DeliveryStatus.SENT) sent++;
    else if (updated.status === DeliveryStatus.FAILED) failed++;
  }

  return { processed: eligibleDeliveries.length, sent, failed };
}
