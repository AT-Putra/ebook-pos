import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyWahaSignature, fetchInboundMedia, parseJid, resolveLidToPhone, resolvePhoneToLid } from '@/lib/waha';
import { findActiveChallengeOrderByWhatsapp, storeProofSubmission, type ChallengeOrder } from '@/lib/challenge-inbox';
import { normalizeIndonesianPhone } from '@/lib/phone';

// WAHA inbound message webhook — auto-captures challenge proof videos (PRD §21.6).
// Authenticated by HMAC-SHA512 (X-Webhook-Hmac, key = WAHA_WEBHOOK_SECRET). Idempotent
// on payload.id. Always acks 200 quickly to valid calls so WAHA doesn't retry-storm.
// The idempotency-critical core (store + record + advance + ack) is shared with the Fonnte
// webhook via lib/challenge-inbox.ts (§24.4); this route owns WAHA's HMAC + LID resolution.

type WahaMedia = { url?: string; mimetype?: string; filename?: string };
type WahaMessagePayload = {
  id?: string;
  from?: string;
  fromMe?: boolean;
  hasMedia?: boolean;
  media?: WahaMedia;
};

const TAG = '[waha-inbox]';

export async function POST(req: NextRequest) {
  const raw = await req.text();

  // 1. Authenticate (HMAC over the raw body). Fails closed if the secret is unset.
  if (!verifyWahaSignature(raw, req.headers.get('x-webhook-hmac'))) {
    console.warn(`${TAG} 401 rejected: invalid/missing X-Webhook-Hmac (check WAHA_WEBHOOK_SECRET matches the WAHA hmac.key)`);
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 });
  }

  let body: { event?: string; payload?: WahaMessagePayload };
  try {
    body = JSON.parse(raw);
  } catch {
    console.warn(`${TAG} 400 invalid JSON body`);
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const payload = body.payload ?? {};
  console.log(`${TAG} received event=%s from=%s hasMedia=%s mime=%s id=%s`,
    body.event, payload.from, payload.hasMedia, payload.media?.mimetype, payload.id);

  const ignore = (reason: string) => {
    console.log(`${TAG} ignored: ${reason}`);
    return NextResponse.json({ ok: true, ignored: reason });
  };

  // Only incoming message events with a video attachment matter.
  if (body.event !== 'message') return ignore('event');
  if (payload.fromMe) return ignore('fromMe');

  const messageId = payload.id ?? null;
  const media = payload.media;
  const mimeType = media?.mimetype ?? '';
  if (!payload.hasMedia || !media?.url || !mimeType.startsWith('video/')) {
    return ignore('no-video');
  }
  const mediaUrl = media.url;

  // 2. Resolve the sender to a phone number. WhatsApp now often sends a privacy `…@lid` id
  //    instead of `…@c.us`; a LID is not a phone number, so map it via WAHA's LIDs API (§21.6).
  const sender = parseJid(payload.from ?? '');
  let whatsapp: string | null = null;
  let inboundLidId: string | null = null;

  if (sender.kind === 'phone') {
    try { whatsapp = normalizeIndonesianPhone(sender.id); } catch { return ignore('bad-number'); }
  } else if (sender.kind === 'lid') {
    inboundLidId = sender.id;
    try {
      const pn = await resolveLidToPhone(payload.from!);
      if (pn) {
        try { whatsapp = normalizeIndonesianPhone(parseJid(pn).id); } catch { /* keep null → fall back */ }
      }
    } catch (err) {
      console.warn(`${TAG} lid→pn resolve error:`, err);
    }
  } else {
    return ignore('not-direct');
  }

  // 3. Match sender → a PAID order for a challenge-active program.
  let order: ChallengeOrder | null = whatsapp ? await findActiveChallengeOrderByWhatsapp(whatsapp) : null;

  // Fallback: WAHA couldn't map the LID → phone (pn null). Match by resolving each candidate
  // buyer's phone → LID and comparing to the inbound LID (the reliable direction).
  if (!order && inboundLidId) {
    const candidates = await db.order.findMany({
      where: { status: 'PAID', product: { challenge: { isActive: true } } },
      orderBy: { paidAt: 'desc' },
      include: { customer: true, product: { include: { challenge: true } } },
    });
    const checked = new Set<string>();
    for (const c of candidates) {
      if (checked.has(c.customer.whatsapp)) continue;
      checked.add(c.customer.whatsapp);
      const lid = await resolvePhoneToLid(c.customer.whatsapp);
      if (lid && parseJid(lid).id === inboundLidId) {
        order = c;
        whatsapp = c.customer.whatsapp;
        break;
      }
    }
  }

  if (!order || !order.product.challenge || !order.paidAt || !whatsapp) {
    return ignore('no-active-challenge');
  }

  // 4. Hand off to the shared, engine-agnostic core (store + record + advance + ack).
  const result = await storeProofSubmission({
    order,
    whatsapp,
    messageId,
    mimeTypeHint: mimeType,
    rawPayload: payload as object,
    downloadMedia: () => fetchInboundMedia(mediaUrl),
  });

  if (result.status === 'ignored') return ignore(result.reason ?? 'ignored');
  return NextResponse.json({ ok: true });
}
