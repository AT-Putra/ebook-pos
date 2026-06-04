import { DeliveryStatus } from '@prisma/client';
import { db } from './db';
import { readEbookAsBase64 } from './files';
import { sendFile } from './waha';
import { toChatId } from './phone';

export const BACKOFF_MINUTES = [1, 5, 15, 60, 360]; // exponential backoff schedule

function nextRetryAt(attempts: number): Date | null {
  const minutes = BACKOFF_MINUTES[attempts];
  if (minutes === undefined) return null; // maxAttempts reached
  const d = new Date();
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

/**
 * Attempts to send an e-book delivery.
 * Idempotent: skips if already SENT or PROCESSING.
 * Updates Delivery row with result.
 */
export async function attemptDelivery(deliveryId: string): Promise<void> {
  // Fetch delivery + order + customer + product in one query.
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

  // Exactly-once guard: never re-send if already SENT.
  if (delivery.status === DeliveryStatus.SENT) return;

  // Skip if another worker is already processing this delivery.
  if (delivery.status === DeliveryStatus.PROCESSING) return;

  // Mark as PROCESSING to prevent concurrent sends.
  await db.delivery.update({
    where: { id: deliveryId },
    data: { status: DeliveryStatus.PROCESSING },
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
