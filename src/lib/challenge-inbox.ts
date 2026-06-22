import { ParticipantStatus, Prisma } from '@prisma/client';
import { db } from './db';
import { saveChallengeMedia } from './files';
import { sendChallengeReminderOnce } from './challenge-reminders';

// Shared, engine-agnostic core of inbound challenge proof-video capture (slice D15, §24.4).
// Both /api/webhooks/waha (HMAC + LID resolution) and /api/webhooks/fonnte (URL token + plain
// number) authenticate + resolve the sender their own way, then hand off the idempotency-critical
// work — match order → upsert participant → store the private video → record submission → advance
// status → ack — to the functions here, so that logic never diverges between engines.

const TAG = '[challenge-inbox]';

export type ChallengeOrder = Prisma.OrderGetPayload<{
  include: { customer: true; product: { include: { challenge: true } } };
}>;

/** Finds the most recent PAID order for a challenge-active program matched by WhatsApp number
 *  (so a buyer with more than one Customer row still matches). Engine-agnostic. */
export async function findActiveChallengeOrderByWhatsapp(whatsapp: string): Promise<ChallengeOrder | null> {
  return db.order.findFirst({
    where: { status: 'PAID', customer: { whatsapp }, product: { challenge: { isActive: true } } },
    orderBy: { paidAt: 'desc' },
    include: { customer: true, product: { include: { challenge: true } } },
  });
}

export type StoreProofResult = { status: 'accepted' | 'ignored'; reason?: string };

/**
 * Idempotently records an inbound proof video for a matched challenge order. The provider-specific
 * media download is injected (`downloadMedia`) so WAHA (X-Api-Key) and Fonnte (public url) share
 * this. Dedupes on `messageId` (the generic provider-message id stored in `ChallengeSubmission.
 * wahaMessageId`). Never auto-verifies; auto-acks a stored video via the `proof_received` template.
 */
export async function storeProofSubmission(args: {
  order: ChallengeOrder;
  whatsapp: string;
  messageId: string | null;
  mimeTypeHint: string;
  rawPayload: object;
  downloadMedia: () => Promise<{ buffer: Buffer; mimeType: string; sizeBytes: number }>;
}): Promise<StoreProofResult> {
  const { order, whatsapp, messageId, mimeTypeHint, rawPayload, downloadMedia } = args;
  const challenge = order.product.challenge;
  if (!challenge || !order.paidAt) return { status: 'ignored', reason: 'no-active-challenge' };

  // 1. Idempotency — a re-delivered event is a no-op.
  if (messageId) {
    const dup = await db.challengeSubmission.findUnique({ where: { wahaMessageId: messageId } });
    if (dup) return { status: 'ignored', reason: 'duplicate' };
  }

  // 2. Find or create the participant (one per order). Upsert avoids a create race under
  //    concurrent retries (orderId is unique).
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

  // 3. Classify by whether the challenge has started: not started → initial (so a re-sent initial
  //    proof after a rejection is still treated as initial); started → final.
  const kind: 'initial' | 'final' = participant.startAt ? 'final' : 'initial';

  // 4. Fetch + store the media privately (reject oversize without persisting the file).
  const maxBytes = (challenge.videoMaxSizeMb + 5) * 1024 * 1024; // small margin over the configured cap
  let mediaPath: string | null = null;
  let rejectedReason: string | null = null;
  let sizeBytes: number | null = null;
  let storedMime = mimeTypeHint;
  try {
    const fetched = await downloadMedia();
    sizeBytes = fetched.sizeBytes;
    storedMime = fetched.mimeType || mimeTypeHint;
    if (fetched.sizeBytes > maxBytes) {
      rejectedReason = 'oversize';
    } else {
      mediaPath = await saveChallengeMedia(fetched.buffer, storedMime);
    }
  } catch (err) {
    rejectedReason = `download_failed: ${err instanceof Error ? err.message : String(err)}`;
  }

  // 5. Record the submission (idempotent on wahaMessageId — a concurrent duplicate loses the race).
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
        rawPayload: rawPayload as object,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return { status: 'ignored', reason: 'duplicate' };
    }
    throw err;
  }

  // 6. Advance status.
  if (kind === 'final' && participant.status === ParticipantStatus.RUNNING) {
    await db.challengeParticipant.update({
      where: { id: participant.id },
      data: { status: ParticipantStatus.PENDING_FINAL_REVIEW, finalSubmittedAt: new Date() },
    });
  } else if (kind === 'initial' && participant.status === ParticipantStatus.AWAITING_INITIAL) {
    await db.challengeParticipant.update({
      where: { id: participant.id },
      data: { status: ParticipantStatus.PENDING_INITIAL_REVIEW },
    });
  }

  // 7. Acknowledge receipt (only when the video was actually stored) via the editable
  //    `proof_received` template. Idempotent per message + humanized; fire-and-forget.
  if (mediaPath) {
    const templates = (challenge.messageTemplates as Record<string, string>) ?? {};
    const ackTpl = templates['proof_received'];
    if (ackTpl) {
      sendChallengeReminderOnce({
        participantId: participant.id,
        whatsapp,
        key: `proof_received:${messageId ?? kind}`,
        template: ackTpl,
        contactInfo: challenge.contactInfo,
        productId: challenge.productId,
      }).catch(err => console.error(`${TAG} proof_received send error:`, err));
    }
  }

  console.log(`${TAG} accepted: participant=%s kind=%s stored=%s%s`,
    participant.id, kind, !!mediaPath, rejectedReason ? ` rejected=${rejectedReason}` : '');
  return { status: 'accepted' };
}
