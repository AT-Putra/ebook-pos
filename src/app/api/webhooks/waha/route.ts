import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyWahaSignature, fetchInboundMedia } from '@/lib/waha';
import { saveChallengeMedia } from '@/lib/files';
import { normalizeIndonesianPhone } from '@/lib/phone';
import { ParticipantStatus } from '@prisma/client';

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

export async function POST(req: NextRequest) {
  const raw = await req.text();

  // 1. Authenticate (HMAC over the raw body). Fails closed if the secret is unset.
  if (!verifyWahaSignature(raw, req.headers.get('x-webhook-hmac'))) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 });
  }

  let body: { event?: string; payload?: WahaMessagePayload };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  // Only incoming message events with a video attachment matter.
  if (body.event !== 'message') return NextResponse.json({ ok: true, ignored: 'event' });
  const payload = body.payload ?? {};
  if (payload.fromMe) return NextResponse.json({ ok: true, ignored: 'fromMe' });

  const messageId = payload.id ?? null;
  const media = payload.media;
  const mimeType = media?.mimetype ?? '';
  if (!payload.hasMedia || !media?.url || !mimeType.startsWith('video/')) {
    return NextResponse.json({ ok: true, ignored: 'no-video' });
  }

  // 2. Idempotency — a re-delivered event is a no-op.
  if (messageId) {
    const dup = await db.challengeSubmission.findUnique({ where: { wahaMessageId: messageId } });
    if (dup) return NextResponse.json({ ok: true, ignored: 'duplicate' });
  }

  // 3. Match sender → Customer → their PAID order for a challenge-active program.
  const chatId = payload.from ?? '';
  if (!chatId.endsWith('@c.us')) return NextResponse.json({ ok: true, ignored: 'not-direct' });
  let whatsapp: string;
  try {
    whatsapp = normalizeIndonesianPhone(chatId.replace('@c.us', ''));
  } catch {
    return NextResponse.json({ ok: true, ignored: 'bad-number' });
  }

  const customer = await db.customer.findFirst({ where: { whatsapp } });
  if (!customer) return NextResponse.json({ ok: true, ignored: 'unknown-sender' });

  const order = await db.order.findFirst({
    where: { customerId: customer.id, status: 'PAID', product: { challenge: { isActive: true } } },
    orderBy: { paidAt: 'desc' },
    include: { product: { include: { challenge: true } } },
  });
  if (!order || !order.product.challenge || !order.paidAt) {
    return NextResponse.json({ ok: true, ignored: 'no-active-challenge' });
  }
  const challenge = order.product.challenge;

  // 4. Find or create the participant (one per order).
  let participant = await db.challengeParticipant.findUnique({
    where: { orderId: order.id },
    include: { submissions: true },
  });
  if (!participant) {
    participant = await db.challengeParticipant.create({
      data: {
        challengeId: challenge.id,
        customerId: customer.id,
        orderId: order.id,
        status: ParticipantStatus.PENDING_INITIAL_REVIEW,
        purchaseAt: order.paidAt,
      },
      include: { submissions: true },
    });
  }

  // 5. Classify: first proof = initial, a later one (while RUNNING) = final.
  const hasInitial = participant.submissions.some(s => s.kind === 'initial');
  const kind = hasInitial ? 'final' : 'initial';

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

  // 7. Record the submission + advance status.
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

  if (kind === 'final' && participant.status === ParticipantStatus.RUNNING) {
    await db.challengeParticipant.update({
      where: { id: participant.id },
      data: { status: ParticipantStatus.PENDING_FINAL_REVIEW, finalSubmittedAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true });
}
