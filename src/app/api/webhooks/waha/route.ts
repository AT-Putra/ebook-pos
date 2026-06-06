import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyWahaSignature, fetchInboundMedia } from '@/lib/waha';
import { saveChallengeMedia } from '@/lib/files';
import { normalizeIndonesianPhone } from '@/lib/phone';
import { ParticipantStatus, Prisma } from '@prisma/client';

// WAHA inbound message webhook — auto-captures challenge proof videos (PRD §21.6).
// Authenticated by HMAC-SHA512 (X-Webhook-Hmac, key = WAHA_WEBHOOK_SECRET). Idempotent
// on payload.id. Always acks 200 quickly to valid calls so WAHA doesn't retry-storm.

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

  // 2. Idempotency — a re-delivered event is a no-op.
  if (messageId) {
    const dup = await db.challengeSubmission.findUnique({ where: { wahaMessageId: messageId } });
    if (dup) return ignore('duplicate');
  }

  // 3. Match sender → a PAID order for a challenge-active program (by WhatsApp number,
  //    so a buyer with more than one Customer row still matches).
  const chatId = payload.from ?? '';
  if (!chatId.endsWith('@c.us')) return ignore('not-direct');
  let whatsapp: string;
  try {
    whatsapp = normalizeIndonesianPhone(chatId.replace('@c.us', ''));
  } catch {
    return ignore('bad-number');
  }

  const order = await db.order.findFirst({
    where: { status: 'PAID', customer: { whatsapp }, product: { challenge: { isActive: true } } },
    orderBy: { paidAt: 'desc' },
    include: { product: { include: { challenge: true } } },
  });
  if (!order || !order.product.challenge || !order.paidAt) {
    return ignore('no-active-challenge');
  }
  const challenge = order.product.challenge;

  // 4. Find or create the participant (one per order). Upsert avoids a create race
  //    under WAHA's concurrent retries (orderId is unique).
  const participant = await db.challengeParticipant.upsert({
    where: { orderId: order.id },
    update: {},
    create: {
      challengeId: challenge.id,
      customerId: order.customerId,
      orderId: order.id,
      status: ParticipantStatus.PENDING_INITIAL_REVIEW,
      purchaseAt: order.paidAt,
    },
  });

  // 5. Classify by whether the challenge has started: not started → initial (so a
  //    re-sent initial proof after a rejection is still treated as initial); started → final.
  const kind = participant.startAt ? 'final' : 'initial';

  // 6. Fetch + store the media privately (reject oversize without persisting the file).
  const maxBytes = (challenge.videoMaxSizeMb + 5) * 1024 * 1024; // small margin over the configured cap
  let mediaPath: string | null = null;
  let rejectedReason: string | null = null;
  let sizeBytes: number | null = null;
  let storedMime = mimeType;
  try {
    const fetched = await fetchInboundMedia(media.url);
    sizeBytes = fetched.sizeBytes;
    storedMime = fetched.mimeType || mimeType;
    if (fetched.sizeBytes > maxBytes) {
      rejectedReason = 'oversize';
    } else {
      mediaPath = await saveChallengeMedia(fetched.buffer, storedMime);
    }
  } catch (err) {
    rejectedReason = `download_failed: ${err instanceof Error ? err.message : String(err)}`;
  }

  // 7. Record the submission (idempotent on wahaMessageId — a concurrent duplicate
  //    delivery loses the race and is treated as a no-op) + advance status.
  try {
    await db.challengeSubmission.create({
      data: {
        participantId: participant.id,
        kind,
        fromNumber: whatsapp,
        wahaMessageId: messageId,
        mediaPath,
        mimeType: storedMime,
        sizeBytes,
        rejectedReason,
        rawPayload: payload as object,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return ignore('duplicate');
    }
    throw err;
  }

  if (kind === 'final' && participant.status === ParticipantStatus.RUNNING) {
    await db.challengeParticipant.update({
      where: { id: participant.id },
      data: { status: ParticipantStatus.PENDING_FINAL_REVIEW, finalSubmittedAt: new Date() },
    });
  }

  console.log(`${TAG} accepted: participant=%s kind=%s stored=%s%s`,
    participant.id, kind, !!mediaPath, rejectedReason ? ` rejected=${rejectedReason}` : '');
  return NextResponse.json({ ok: true });
}
