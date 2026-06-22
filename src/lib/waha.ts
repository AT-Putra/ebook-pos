import crypto from 'crypto';
import { env } from './env';
import { toChatId } from './phone';
import type { WaEngine } from './messaging';

// INVARIANT: WAHA_BASE_URL must be https:// — validated in env.ts at startup.
// This module enforces it again at call time as a defence-in-depth check.

export type WahaSendFileParams = {
  chatId: string;        // e.g. "628123456789@c.us"
  mimeType: string;
  filename: string;
  base64Data: string;    // file contents encoded as base64
  caption?: string;
};

export type WahaMessageResult = {
  id: string;            // message id from WAHA
};

/** Sends a file to a WhatsApp chat via WAHA /api/sendFile.
 *  Always sends base64 in file.data — never a URL (invariant). */
export async function sendFile(p: WahaSendFileParams): Promise<WahaMessageResult> {
  const baseUrl = env.WAHA_BASE_URL;
  if (!baseUrl.startsWith('https://')) {
    throw new Error('WAHA_BASE_URL must start with https:// — refusing to send over plain HTTP.');
  }

  // Prime a never-contacted recipient so the file actually delivers (not just PENDING).
  await primeRecipient(p.chatId);

  const body = {
    session: env.WAHA_SESSION,
    chatId: p.chatId,
    file: {
      mimetype: p.mimeType,
      filename: p.filename,
      data: p.base64Data, // base64 only — never file.url
    },
    caption: p.caption ?? 'Terima kasih atas pembelianmu! 🎉 Berikut e-book kamu.',
  };

  const res = await fetch(`${baseUrl}/api/sendFile`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': env.WAHA_API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WAHA sendFile error (${res.status}): ${text}`);
  }

  const data = await res.json() as { id?: string };
  await logWahaSendDev('sendFile', p.chatId, data);
  return { id: data.id ?? '' };
}

// ── Inbound (Challenge proof videos, §21.6) ─────────────────────────────────

/** Verifies WAHA's webhook HMAC (SHA512 of the raw body, key = WAHA_WEBHOOK_SECRET).
 *  Header is `X-Webhook-Hmac` (hex). Fails closed if the secret is not configured. */
export function verifyWahaSignature(rawBody: string, headerHmac: string | null): boolean {
  const secret = env.WAHA_WEBHOOK_SECRET;
  if (!secret || !headerHmac) return false;
  const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(headerHmac, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Downloads inbound media from a WAHA `media.url` (auth via X-Api-Key; https only). */
export async function fetchInboundMedia(
  mediaUrl: string,
): Promise<{ buffer: Buffer; mimeType: string; sizeBytes: number }> {
  if (!mediaUrl.startsWith('https://')) {
    throw new Error('WAHA media.url must be https:// — refusing to fetch over plain HTTP.');
  }
  const res = await fetch(mediaUrl, { headers: { 'X-Api-Key': env.WAHA_API_KEY } });
  if (!res.ok) {
    throw new Error(`WAHA media fetch error (${res.status})`);
  }
  const mimeType = res.headers.get('content-type')?.split(';')[0]?.trim() || 'application/octet-stream';
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, mimeType, sizeBytes: buffer.length };
}

// ── WhatsApp LID (privacy id) resolution (§21.6) ────────────────────────────
// WhatsApp increasingly sends inbound messages with a `…@lid` sender id instead of the
// phone-number `…@c.us` id. A LID is NOT a phone number, so we map it via WAHA's LIDs API.

/** Classifies a WAHA JID. Pure → testable. `id` is the part before the `@`. */
export function parseJid(jid: string): { kind: 'phone' | 'lid' | 'other'; id: string } {
  if (jid.endsWith('@c.us')) return { kind: 'phone', id: jid.slice(0, -'@c.us'.length) };
  if (jid.endsWith('@lid')) return { kind: 'lid', id: jid.slice(0, -'@lid'.length) };
  return { kind: 'other', id: jid };
}

async function wahaGetJson(path: string): Promise<Record<string, unknown> | null> {
  const baseUrl = env.WAHA_BASE_URL;
  if (!baseUrl.startsWith('https://')) {
    throw new Error('WAHA_BASE_URL must start with https:// — refusing to call over plain HTTP.');
  }
  const res = await fetch(`${baseUrl}${path}`, { headers: { 'X-Api-Key': env.WAHA_API_KEY } });
  if (!res.ok) return null;
  return (await res.json().catch(() => null)) as Record<string, unknown> | null;
}

/** Resolve a `…@lid` to its phone-number chatId (`…@c.us`) via `GET /lids/{lid}`.
 *  Returns null when WAHA has no mapping (`pn` null) — DMs usually resolve fine. */
export async function resolveLidToPhone(lid: string): Promise<string | null> {
  const id = parseJid(lid).id;
  const data = await wahaGetJson(`/api/${encodeURIComponent(env.WAHA_SESSION)}/lids/${encodeURIComponent(id)}`);
  const pn = data?.pn;
  return typeof pn === 'string' ? pn : null;
}

/** Resolve a phone number (bare digits or `…@c.us`) to its `…@lid` via `GET /lids/pn/{pn}`. */
export async function resolvePhoneToLid(phone: string): Promise<string | null> {
  const id = parseJid(phone).id;
  const data = await wahaGetJson(`/api/${encodeURIComponent(env.WAHA_SESSION)}/lids/pn/${encodeURIComponent(id)}`);
  const lid = data?.lid;
  return typeof lid === 'string' ? lid : null;
}

// ── Recipient priming (first-contact delivery, §12.2.1) ─────────────────────
// WhatsApp is end-to-end encrypted: to deliver to a number that has NEVER contacted
// the WAHA account, the engine first needs that recipient's key bundle / session —
// otherwise the message is accepted by the API but stays `status: PENDING` and never
// arrives. WAHA's number-existence check performs the on-WhatsApp lookup that resolves
// the recipient and primes that session, so the send actually delivers.

/** Checks whether a phone number is registered on WhatsApp via WAHA's
 *  `GET /api/contacts/check-exists`. Returns null if the call itself fails. */
export async function checkNumberExists(
  phone: string,
): Promise<{ numberExists: boolean; chatId: string | null } | null> {
  const id = parseJid(phone).id;
  const data = await wahaGetJson(
    `/api/contacts/check-exists?phone=${encodeURIComponent(id)}&session=${encodeURIComponent(env.WAHA_SESSION)}`,
  );
  if (!data) return null;
  return {
    numberExists: data.numberExists === true,
    chatId: typeof data.chatId === 'string' ? data.chatId : null,
  };
}

/** Randomized pause (ms) after the existence check, before the actual send. Pure → testable. */
export function primeDelayMs(rnd: number = Math.random()): number {
  const min = 1500;
  const max = 3500;
  return Math.round(min + rnd * (max - min));
}

/** Primes a recipient before sending: runs the number-existence check (which also
 *  establishes the encryption session for a never-contacted number so the message
 *  actually delivers, not just PENDING), then waits a short randomized delay.
 *  Best-effort — never throws and never blocks the send, even if the number reports
 *  as not existing (the lookup's priming side-effect is what matters). */
async function primeRecipient(chatId: string): Promise<void> {
  try {
    const result = await checkNumberExists(chatId);
    await logWahaSendDev('check-exists', chatId, result);
  } catch {
    // best-effort — a failed check must not block the send
  }
  await sleep(primeDelayMs());
}

/** Logs an outbound WAHA send with the chatId (`…@c.us`), the resolved `…@lid`, and the
 *  WAHA API response — to correlate WhatsApp identities while debugging.
 *  Enabled when NODE_ENV=development OR `WAHA_LOG_SENDS` is truthy (1/true) — the latter lets
 *  you switch it on in production (where NODE_ENV=production) without rebuilding the image.
 *  No-op otherwise; the LID lookup is best-effort (never throws). */
async function logWahaSendDev(kind: string, chatId: string, response: unknown): Promise<void> {
  const flag = process.env.WAHA_LOG_SENDS;
  const enabled = process.env.NODE_ENV === 'development' || flag === '1' || flag === 'true';
  if (!enabled) return;
  let lid: string | null = null;
  try { lid = await resolvePhoneToLid(chatId); } catch { /* best-effort */ }
  console.log(`[waha-send] ${kind} chatId=${chatId} lid=${lid ?? '-'} response=${JSON.stringify(response)}`);
}

// ── Humanized send sequence (anti-spam, §12.2.1) ────────────────────────────

async function wahaPost(path: string, body: unknown): Promise<Response> {
  const baseUrl = env.WAHA_BASE_URL;
  if (!baseUrl.startsWith('https://')) {
    throw new Error('WAHA_BASE_URL must start with https:// — refusing to call over plain HTTP.');
  }
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': env.WAHA_API_KEY },
    body: JSON.stringify({ session: env.WAHA_SESSION, ...(body as object) }),
  });
}

/** Typing delay (ms) scaled to message length, with jitter. Pure → testable. */
export function typingDelayMs(text: string, rnd: number = Math.random()): number {
  const base = 800;
  const perChar = 35;
  const cap = 6000;
  const scaled = Math.min(base + text.length * perChar, cap);
  return Math.round(scaled * (0.7 + rnd * 0.6)); // ±30% jitter
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/**
 * Sends a text the human-like way to avoid spam flags (§12.2.1):
 * sendSeen → startTyping → wait(scaled) → stopTyping → sendText.
 * Use this for ALL conversational/reminder sends (e.g. the D12 challenge reminders).
 */
export async function sendTextHumanized(p: {
  chatId: string;
  text: string;
  messageId?: string;
}): Promise<WahaMessageResult> {
  // Prime a never-contacted recipient first (then the humanized sequence below).
  await primeRecipient(p.chatId);
  try {
    await wahaPost('/api/sendSeen', { chatId: p.chatId, messageIds: p.messageId ? [p.messageId] : undefined });
    await wahaPost('/api/startTyping', { chatId: p.chatId });
    await sleep(typingDelayMs(p.text));
    await wahaPost('/api/stopTyping', { chatId: p.chatId });
  } catch {
    // Best-effort presence signals — never block the actual send on them.
  }
  const res = await wahaPost('/api/sendText', { chatId: p.chatId, text: p.text });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`WAHA sendText error (${res.status}): ${errText}`);
  }
  const data = await res.json() as { id?: string };
  await logWahaSendDev('sendText', p.chatId, data);
  return { id: data.id ?? '' };
}

// ── Engine adapter (slice D15, §24.2) ───────────────────────────────────────
// Thin wrapper exposing WAHA through the provider-agnostic WaEngine interface. Takes the
// normalized 628… phone and formats it to a `…@c.us` chatId; all WAHA behaviour is unchanged.

export const wahaEngine: WaEngine = {
  name: 'waha',
  sendFile: p =>
    sendFile({
      chatId: toChatId(p.phone),
      mimeType: p.mimeType,
      filename: p.filename,
      base64Data: p.base64Data,
      caption: p.caption,
    }),
  sendText: p => sendTextHumanized({ chatId: toChatId(p.phone), text: p.text, messageId: p.messageId }),
};
