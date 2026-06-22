import crypto from 'crypto';
import { env } from './env';
import type { WaEngine, WaSendFileParams, WaSendTextParams, WaSendResult } from './messaging';

// Fonnte WhatsApp engine adapter (slice D15, §24). One endpoint for everything:
//   POST https://api.fonnte.com/send   Authorization: <FONNTE_TOKEN>   (no "Bearer" prefix)
// Text → form-urlencoded `message`; file → multipart binary `file` (NEVER a public `url`, inv. #4/#5).
// Humanization (§12.2.1) is delegated to Fonnte's server-side `typing`/`delay` params.

export const FONNTE_API_URL = 'https://api.fonnte.com/send';

type FonnteResponse = {
  status?: boolean;
  id?: string | string[];
  detail?: string;
  reason?: string;
};

/** Pure: turns a Fonnte /send response into a message id, or throws a clear error.
 *  Fonnte returns `{ status:true, id:[…] }` on success, `{ status:false, reason }` on failure. */
export function parseFonnteSendResponse(httpOk: boolean, status: number, data: FonnteResponse | null): WaSendResult {
  if (!httpOk || !data || data.status !== true) {
    const reason = data?.reason || data?.detail || `HTTP ${status}`;
    throw new Error(`Fonnte send error: ${reason}`);
  }
  const id = Array.isArray(data.id) ? data.id[0] : data.id;
  return { id: id != null ? String(id) : '' };
}

/** Randomized inter-target delay string for Fonnte (anti-spam, §12.2.1). e.g. "2-5". */
export function fonnteDelay(): string {
  return '2-5';
}

function requireToken(): string {
  const token = env.FONNTE_TOKEN;
  if (!token) {
    throw new Error('FONNTE_TOKEN is not set — cannot send via Fonnte. Set it in the environment or switch the engine to WAHA.');
  }
  return token;
}

async function postForm(body: URLSearchParams | FormData): Promise<WaSendResult> {
  const token = requireToken();
  // For URLSearchParams the runtime sets Content-Type; for FormData fetch sets the multipart boundary.
  const res = await fetch(FONNTE_API_URL, {
    method: 'POST',
    headers: { Authorization: token },
    body,
  });
  const data = (await res.json().catch(() => null)) as FonnteResponse | null;
  return parseFonnteSendResponse(res.ok, res.status, data);
}

/** Sends a text message via Fonnte with the typing indicator on (humanized, §12.2.1). */
async function sendText(p: WaSendTextParams): Promise<WaSendResult> {
  const form = new URLSearchParams();
  form.set('target', p.phone); // bare 628… digits
  form.set('message', p.text);
  form.set('typing', 'true');
  form.set('delay', fonnteDelay());
  return postForm(form);
}

/** Sends a file via Fonnte as a binary multipart upload (never a public URL — inv. #4/#5). */
async function sendFile(p: WaSendFileParams): Promise<WaSendResult> {
  const buffer = Buffer.from(p.base64Data, 'base64');
  const form = new FormData();
  form.set('target', p.phone);
  if (p.caption) form.set('message', p.caption);
  form.set('filename', p.filename);
  form.set('typing', 'true');
  form.set('file', new Blob([buffer], { type: p.mimeType }), p.filename);
  return postForm(form);
}

export const fonnteEngine: WaEngine = { name: 'fonnte', sendFile, sendText };

// ── Inbound (challenge proof videos, §24.4) ─────────────────────────────────
// Fonnte POSTs form fields and provides NO HMAC — the route authenticates via a shared
// secret in the URL (`?token=…`). Sender is a plain phone number (no `…@lid`).

export type FonnteInbound = {
  sender: string | null;
  message: string | null;
  name: string | null;
  mediaUrl: string | null;
  filename: string | null;
  extension: string | null;
  providedId: string | null;
};

/** Pure: extracts the fields we care about from Fonnte's inbound form payload. */
export function parseFonnteInbound(fields: Record<string, string>): FonnteInbound {
  const get = (k: string): string | null => {
    const v = fields[k];
    return typeof v === 'string' && v.length > 0 ? v : null;
  };
  return {
    sender: get('sender'),
    message: get('message'),
    name: get('name'),
    mediaUrl: get('url'),
    filename: get('filename'),
    extension: get('extension'),
    providedId: get('id'),
  };
}

const VIDEO_EXTENSIONS = ['mp4', '3gp', 'mov', 'mkv', 'webm', 'avi', 'm4v'];

/** Pure: best-effort decision whether an inbound attachment is a video (Fonnte gives no mimetype). */
export function isFonnteVideo(p: { mediaUrl: string | null; filename: string | null; extension: string | null }): boolean {
  if (!p.mediaUrl) return false;
  const ext = (p.extension || p.filename?.split('.').pop() || p.mediaUrl.split('.').pop() || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return VIDEO_EXTENSIONS.includes(ext);
}

/** Pure: a stable idempotency key for an inbound message. Fonnte does not guarantee a message id,
 *  so fall back to a hash of sender+url+message (a re-delivery of the same media dedupes). */
export function fonnteInboundMessageId(p: FonnteInbound): string {
  if (p.providedId) return p.providedId;
  const basis = `${p.sender ?? ''}|${p.mediaUrl ?? ''}|${p.message ?? ''}`;
  return 'fonnte:' + crypto.createHash('sha256').update(basis).digest('hex').slice(0, 32);
}

/** Constant-time compare of the webhook URL token against FONNTE_WEBHOOK_SECRET.
 *  Fails closed when the secret is unset (mirrors verifyWahaSignature). */
export function verifyFonnteWebhookToken(token: string | null): boolean {
  const secret = env.FONNTE_WEBHOOK_SECRET;
  if (!secret || !token) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(token);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Downloads inbound media from Fonnte's public `url` (no auth header). HTTPS only. */
export async function downloadFonnteMedia(
  mediaUrl: string,
): Promise<{ buffer: Buffer; mimeType: string; sizeBytes: number }> {
  if (!mediaUrl.startsWith('https://')) {
    throw new Error('Fonnte media url must be https:// — refusing to fetch over plain HTTP.');
  }
  const res = await fetch(mediaUrl);
  if (!res.ok) {
    throw new Error(`Fonnte media fetch error (${res.status})`);
  }
  const mimeType = res.headers.get('content-type')?.split(';')[0]?.trim() || 'video/mp4';
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, mimeType, sizeBytes: buffer.length };
}
