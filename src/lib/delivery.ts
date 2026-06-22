import { DeliveryStatus, WaLogStatus } from '@prisma/client';
import { db } from './db';
import { readEbookAsBase64, readEbookAsBuffer } from './files';
import { getWaEngine } from './messaging';
import { toChatId } from './phone';
import { logWaSend } from './wa-log';
import { isEmailConfigured, sendEbookEmail } from './email';

export const BACKOFF_MINUTES = [1, 5, 15, 60, 360]; // exponential backoff schedule

// How long a delivery may sit in PROCESSING before it's considered orphaned
// (e.g. the process crashed mid-send) and reclaimed for retry by the cron.
const STALE_PROCESSING_MINUTES = 10;

/** A file to deliver, snapshotted from the product at purchase time. */
export type DeliverySnapshotItem = {
  kind: 'ebook' | 'attachment';
  filePath: string;
  fileName: string;
  sortOrder: number;
};

type ProductLike = { filePath: string; fileName: string };
type AttachmentLike = { filePath: string; fileName: string; sortOrder: number };

/** Pure: builds the ordered list of files for a delivery — e-book first (sortOrder 0),
 *  then attachments by their own sortOrder (re-indexed from 1 to keep them stable). */
export function buildDeliverySnapshot(
  product: ProductLike,
  attachments: AttachmentLike[],
): DeliverySnapshotItem[] {
  const ebook: DeliverySnapshotItem = {
    kind: 'ebook',
    filePath: product.filePath,
    fileName: product.fileName,
    sortOrder: 0,
  };
  const sorted = [...attachments].sort((a, b) => a.sortOrder - b.sortOrder);
  const items: DeliverySnapshotItem[] = sorted.map((a, i) => ({
    kind: 'attachment',
    filePath: a.filePath,
    fileName: a.fileName,
    sortOrder: i + 1,
  }));
  return [ebook, ...items];
}

/** Pure: true when every item has been delivered. */
export function allItemsSent(items: { status: DeliveryStatus }[]): boolean {
  return items.length > 0 && items.every(i => i.status === DeliveryStatus.SENT);
}

/** Delay before the next retry, given how many attempts have now been made.
 *  attemptsSoFar=1 → first retry uses BACKOFF_MINUTES[0]. */
function nextRetryAt(attemptsSoFar: number): Date | null {
  const minutes = BACKOFF_MINUTES[attemptsSoFar - 1];
  if (minutes === undefined) return null; // schedule exhausted
  const d = new Date();
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

/** Creates the DeliveryItem rows for a delivery if it has none yet (snapshot at PAID). */
async function ensureDeliveryItems(deliveryId: string): Promise<void> {
  const count = await db.deliveryItem.count({ where: { deliveryId } });
  if (count > 0) return;

  const delivery = await db.delivery.findUniqueOrThrow({
    where: { id: deliveryId },
    include: { order: { include: { product: { include: { attachments: true } } } } },
  });
  const { product } = delivery.order;
  const snapshot = buildDeliverySnapshot(product, product.attachments);

  // Per-row create (not createMany) so Prisma reliably fills @updatedAt; the list is tiny.
  for (const s of snapshot) {
    await db.deliveryItem.create({
      data: {
        deliveryId,
        kind: s.kind,
        filePath: s.filePath,
        fileName: s.fileName,
        sortOrder: s.sortOrder,
      },
    });
  }
}

/**
 * Attempts to deliver an order's files (e-book + attachments).
 * Exactly-once per file: atomically claims the Delivery (PENDING/FAILED → PROCESSING)
 * so two concurrent callers can't both send, then sends each DeliveryItem not yet SENT.
 * A retry re-sends only the not-yet-SENT items; the Delivery is SENT only once all are.
 */
export async function attemptDelivery(deliveryId: string): Promise<void> {
  // Atomic claim — only one caller can move PENDING/FAILED → PROCESSING (invariant #3).
  const claim = await db.delivery.updateMany({
    where: { id: deliveryId, status: { in: [DeliveryStatus.PENDING, DeliveryStatus.FAILED] } },
    data: { status: DeliveryStatus.PROCESSING },
  });
  if (claim.count === 0) return; // already SENT/PROCESSING, or row not found

  await ensureDeliveryItems(deliveryId);

  const delivery = await db.delivery.findUniqueOrThrow({
    where: { id: deliveryId },
    include: {
      items: { orderBy: { sortOrder: 'asc' } },
      order: { include: { customer: true, product: true } },
    },
  });

  const { order, items } = delivery;
  const { customer, product } = order;
  const chatId = toChatId(customer.whatsapp); // audit label for the WA log (engine-agnostic)
  const engine = await getWaEngine();

  let anyFailed = false;

  for (const item of items) {
    if (item.status === DeliveryStatus.SENT) continue; // never re-send a delivered file

    const caption =
      item.kind === 'ebook'
        ? `Terima kasih atas pembelianmu, ${customer.name}! 🎉 Berikut e-book kamu: *${product.name}*`
        : `📎 Lampiran untuk *${product.name}*: ${item.fileName}`;

    try {
      const base64Data = await readEbookAsBase64(item.filePath);
      const result = await engine.sendFile({
        phone: customer.whatsapp,
        mimeType: item.kind === 'ebook' ? product.mimeType : 'application/pdf',
        filename: item.fileName,
        base64Data,
        caption,
      });

      await db.deliveryItem.update({
        where: { id: item.id },
        data: {
          status: DeliveryStatus.SENT,
          wahaMessageId: result.id,
          sentAt: new Date(),
          attempts: { increment: 1 },
          lastError: null,
        },
      });
      await logWaSend({
        category: item.kind === 'ebook' ? 'ebook' : 'attachment',
        status: WaLogStatus.SENT,
        chatId,
        fileName: item.fileName,
        body: caption,
        wahaMessageId: result.id,
        orderId: order.id,
        deliveryId,
        deliveryItemId: item.id,
        productId: order.productId,
      });
    } catch (err) {
      anyFailed = true;
      const message = err instanceof Error ? err.message : String(err);
      await db.deliveryItem.update({
        where: { id: item.id },
        data: {
          status: DeliveryStatus.FAILED,
          attempts: { increment: 1 },
          lastError: message,
        },
      });
      await logWaSend({
        category: item.kind === 'ebook' ? 'ebook' : 'attachment',
        status: WaLogStatus.FAILED,
        chatId,
        fileName: item.fileName,
        body: caption,
        error: message,
        orderId: order.id,
        deliveryId,
        deliveryItemId: item.id,
        productId: order.productId,
      });
    }
  }

  // Email fallback (D14, §23): if any file failed over WhatsApp on this pass, also email the
  // complete set to the buyer — in parallel with the WhatsApp retry, which proceeds unchanged
  // below. Best-effort: never blocks/fails the WhatsApp delivery, idempotent (once per order).
  if (anyFailed) {
    try {
      await maybeSendEmailFallback(deliveryId);
    } catch (err) {
      console.error(`[email-fallback] unexpected error for delivery ${deliveryId}:`, err);
    }
  }

  // Roll the per-item results up to the Delivery.
  const fresh = await db.deliveryItem.findMany({ where: { deliveryId } });

  if (!anyFailed && allItemsSent(fresh)) {
    // First message id kept on the Delivery for back-compat.
    const first = fresh.sort((a, b) => a.sortOrder - b.sortOrder)[0];
    await db.delivery.update({
      where: { id: deliveryId },
      data: {
        status: DeliveryStatus.SENT,
        wahaMessageId: first?.wahaMessageId ?? null,
        sentAt: new Date(),
        attempts: { increment: 1 },
        lastError: null,
      },
    });
    return;
  }

  // At least one file still pending/failed → schedule a retry (or go terminal).
  const newAttempts = delivery.attempts + 1;
  const isTerminal = newAttempts >= delivery.maxAttempts;
  const retryAt = isTerminal ? null : nextRetryAt(newAttempts);
  const lastError = fresh.find(i => i.status === DeliveryStatus.FAILED)?.lastError ?? null;

  await db.delivery.update({
    where: { id: deliveryId },
    data: {
      status: isTerminal ? DeliveryStatus.FAILED : DeliveryStatus.PENDING,
      attempts: { increment: 1 },
      lastError,
      nextRetryAt: retryAt,
    },
  });

  if (isTerminal) {
    console.error(
      `[delivery] Terminal failure for delivery ${deliveryId} (order ${order.orderCode}): ${lastError}`,
    );
  }
}

/**
 * Email fallback (D14, §23): emails the buyer the complete file set (e-book + all attachments)
 * when a WhatsApp delivery item has failed. Best-effort and idempotent — sends at most once per
 * order (guarded by `emailFallbackSentAt`); a send failure is recorded and retried on the next
 * delivery pass. A no-op unless the email fallback is configured (env). Never re-throws.
 */
async function maybeSendEmailFallback(deliveryId: string): Promise<void> {
  if (!isEmailConfigured()) return;

  const delivery = await db.delivery.findUnique({
    where: { id: deliveryId },
    include: {
      items: { orderBy: { sortOrder: 'asc' } },
      order: { include: { customer: true, product: true } },
    },
  });
  if (!delivery) return;
  if (delivery.emailFallbackSentAt) return; // already emailed — idempotent

  const { order, items } = delivery;
  const { customer, product } = order;
  const to = customer.email?.trim();
  if (!to) return; // no address to send to (shouldn't happen — email is required at checkout)

  try {
    // Send the COMPLETE set regardless of which item failed, so the buyer gets a self-contained copy.
    const attachments = await Promise.all(
      items.map(async item => ({
        filename: item.fileName,
        content: await readEbookAsBuffer(item.filePath),
      })),
    );
    const result = await sendEbookEmail({
      to,
      customerName: customer.name,
      productName: product.name,
      attachments,
    });
    await db.delivery.update({
      where: { id: deliveryId },
      data: {
        emailFallbackSentAt: new Date(),
        emailFallbackError: null,
        emailFallbackAttempts: { increment: 1 },
      },
    });
    console.log(
      `[email-fallback] sent for delivery ${deliveryId} (order ${order.orderCode}) → ${to} (messageId=${result.messageId})`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.delivery.update({
      where: { id: deliveryId },
      data: {
        emailFallbackError: message,
        emailFallbackAttempts: { increment: 1 },
      },
    });
    console.error(`[email-fallback] FAILED for delivery ${deliveryId}: ${message}`);
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
