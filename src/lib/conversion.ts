import { db } from './db';

// Server-to-server conversion postback to a single ad publisher (slice D17, §26). On PAID, fire a
// GET "pixel" to the operator-configured URL, substituting macros. trxid = Order.trackingId (reuse).
// Best-effort + idempotent (once per order) — never blocks/fails checkout or delivery.

export type ConversionConfig = { enabled: boolean; postbackUrl: string | null };

export const DEFAULT_CONVERSION_CONFIG: ConversionConfig = { enabled: false, postbackUrl: null };

// ── Config (cached read; cleared on update) — same pattern as lib/rate-limit.ts ──
let cache: { value: ConversionConfig; at: number } | null = null;
const CONFIG_TTL_MS = 10_000;

export function clearConversionConfigCache() {
  cache = null;
}

export async function getConversionConfig(): Promise<ConversionConfig> {
  if (cache && Date.now() - cache.at < CONFIG_TTL_MS) return cache.value;
  const row = await db.conversionConfig.findUnique({ where: { id: 'default' } });
  const value: ConversionConfig = row
    ? { enabled: row.enabled, postbackUrl: row.postbackUrl }
    : DEFAULT_CONVERSION_CONFIG;
  cache = { value, at: Date.now() };
  return value;
}

/** Pure: validates an operator-supplied postback URL template. Must be https and contain {trxid}. */
export function validatePostbackUrl(url: string): { ok: true } | { ok: false; error: string } {
  if (!/^https:\/\//i.test(url)) return { ok: false, error: 'URL postback harus diawali https://' };
  if (!url.includes('{trxid}')) return { ok: false, error: 'URL postback wajib memuat macro {trxid}.' };
  return { ok: true };
}

/** Pure: renders the postback URL, URL-encoding values and replacing only the macros present in the
 *  template. {trxid} required (caller ensures it exists); {amount}/{orderid} optional. */
export function renderPostbackUrl(
  template: string,
  vars: { trxid: string; amount: number; orderCode: string },
): string {
  return template
    .replaceAll('{trxid}', encodeURIComponent(vars.trxid))
    .replaceAll('{amount}', encodeURIComponent(String(vars.amount)))
    .replaceAll('{orderid}', encodeURIComponent(vars.orderCode));
}

/**
 * Sends the conversion postback for one order, exactly once. Best-effort + idempotent: a no-op unless the
 * postback is enabled, the order has a non-empty trackingId (= trxid) and is PAID, a URL is configured, and
 * it hasn't already been sent (`conversionPostbackSentAt`). Never throws.
 */
export async function sendConversionPostback(orderId: string): Promise<void> {
  try {
    const order = await db.order.findUnique({ where: { id: orderId } });
    if (!order) return;
    if (order.status !== 'PAID') return;
    if (order.conversionPostbackSentAt) return; // already sent — idempotent
    const trxid = order.trackingId?.trim();
    if (!trxid) return; // no click id → not an ad conversion

    const cfg = await getConversionConfig();
    if (!cfg.enabled || !cfg.postbackUrl) return;

    const url = renderPostbackUrl(cfg.postbackUrl, {
      trxid,
      amount: order.amountIdr,
      orderCode: order.orderCode,
    });

    try {
      const res = await fetch(url, { method: 'GET', redirect: 'follow' });
      if (!res.ok) throw new Error(`Postback HTTP ${res.status}`);
      await db.order.update({
        where: { id: orderId },
        data: {
          conversionPostbackSentAt: new Date(),
          conversionPostbackError: null,
          conversionPostbackAttempts: { increment: 1 },
        },
      });
      console.log(`[conversion] postback sent for order ${order.orderCode} (trxid=${trxid})`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await db.order.update({
        where: { id: orderId },
        data: {
          conversionPostbackError: message,
          conversionPostbackAttempts: { increment: 1 },
        },
      });
      console.error(`[conversion] postback FAILED for order ${order.orderCode}: ${message}`);
    }
  } catch (err) {
    // Outer guard — a postback must never break the caller (webhook/cron).
    console.error(`[conversion] unexpected error for order ${orderId}:`, err);
  }
}

/** Cron sweep: retry PAID orders with a trackingId that haven't been posted back yet. Idempotent. */
export async function processPendingConversionPostbacks(): Promise<{ processed: number }> {
  const cfg = await getConversionConfig();
  if (!cfg.enabled || !cfg.postbackUrl) return { processed: 0 };

  const candidates = await db.order.findMany({
    where: {
      status: 'PAID',
      conversionPostbackSentAt: null,
      trackingId: { not: null },
    },
    select: { id: true },
    take: 200,
  });

  for (const o of candidates) await sendConversionPostback(o.id);
  return { processed: candidates.length };
}
