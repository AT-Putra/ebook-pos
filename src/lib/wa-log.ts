import { WaLogStatus } from '@prisma/client';
import { db } from './db';
import { parseJid } from './waha';

// WA Logs (slice D5, §20.13). A best-effort audit trail of every OUTBOUND WhatsApp send
// (e-book/attachment delivery + challenge reminders). Logging must NEVER block or fail a
// send — every write is wrapped so a logging error is swallowed (just console.error'd).

const PREVIEW_MAX = 140;

/** Pure: a short single-line preview of a caption/text body, truncated with an ellipsis.
 *  Collapses whitespace so multi-line templates render on one row. */
export function buildPreview(text: string | null | undefined, max: number = PREVIEW_MAX): string | null {
  if (!text) return null;
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length === 0) return null;
  return flat.length > max ? flat.slice(0, max - 1).trimEnd() + '…' : flat;
}

/** Pure: best-effort extraction of the bare phone digits from a WAHA chatId.
 *  Returns null for a privacy `…@lid` id (not a phone number) or anything non-numeric. */
export function phoneFromChatId(chatId: string): string | null {
  const { kind, id } = parseJid(chatId);
  if (kind === 'phone' && /^\d+$/.test(id)) return id;
  return null;
}

export type WaLogEntry = {
  category: 'ebook' | 'attachment' | 'reminder';
  status: WaLogStatus;
  chatId: string;
  templateKey?: string | null;
  fileName?: string | null;
  body?: string | null;
  wahaMessageId?: string | null;
  error?: string | null;
  orderId?: string | null;
  deliveryId?: string | null;
  deliveryItemId?: string | null;
  participantId?: string | null;
  productId?: string | null;
};

/** Records one outbound WA send. Best-effort: never throws — a logging failure must not
 *  break the actual delivery/reminder. */
export async function logWaSend(entry: WaLogEntry): Promise<void> {
  try {
    await db.waMessageLog.create({
      data: {
        category: entry.category,
        status: entry.status,
        chatId: entry.chatId,
        toPhone: phoneFromChatId(entry.chatId),
        templateKey: entry.templateKey ?? null,
        fileName: entry.fileName ?? null,
        bodyPreview: buildPreview(entry.body),
        wahaMessageId: entry.wahaMessageId ?? null,
        error: entry.error ?? null,
        orderId: entry.orderId ?? null,
        deliveryId: entry.deliveryId ?? null,
        deliveryItemId: entry.deliveryItemId ?? null,
        participantId: entry.participantId ?? null,
        productId: entry.productId ?? null,
      },
    });
  } catch (err) {
    console.error('[wa-log] failed to record WA send:', err);
  }
}
