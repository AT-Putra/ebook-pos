import { Prisma, ParticipantStatus, WaLogStatus } from '@prisma/client';
import { db } from './db';
import { computeDueReminders, renderTemplate, type ChallengePhase } from './challenge';
import { sendTextHumanized } from './waha';
import { toChatId } from './phone';
import { logWaSend } from './wa-log';

// Guaranteed extra gap BETWEEN messages (on top of sendTextHumanized's own typing delay),
// so even short templates / many recipients never approach a per-second burst (anti-spam, §12.2.1).
const MIN_GAP_MS = 3000;
const MAX_GAP_MS = 7000;
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
function interMessageGapMs(): number {
  return Math.round(MIN_GAP_MS + Math.random() * (MAX_GAP_MS - MIN_GAP_MS));
}

/**
 * Sends a single challenge reminder to a participant exactly once. Reserves a
 * `ChallengeReminderLog` row first (idempotent — a `P2002` means another caller/run already
 * sent it → `'skipped'`), then sends via the humanized sequence (§12.2.1). The reminder log
 * dedupes across BOTH callers, so this is safe to call from the hourly cron worker AND from
 * the Midtrans webhook (instant `after_purchase`) without ever double-sending.
 */
export async function sendChallengeReminderOnce(args: {
  participantId: string;
  whatsapp: string;
  key: string;
  template: string;
  contactInfo: string | null;
  productId?: string | null;
}): Promise<'sent' | 'skipped' | 'failed'> {
  const { participantId, whatsapp, key, template, contactInfo, productId } = args;

  // Reserve the slot first (idempotent): if it already exists, someone else sent it.
  try {
    await db.challengeReminderLog.create({ data: { participantId, key } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return 'skipped';
    throw err;
  }

  const chatId = toChatId(whatsapp);
  const text = renderTemplate(template, contactInfo);
  try {
    const result = await sendTextHumanized({ chatId, text });
    await db.challengeReminderLog.update({
      where: { participantId_key: { participantId, key } },
      data: { wahaMessageId: result.id },
    });
    await logWaSend({
      category: 'reminder',
      status: WaLogStatus.SENT,
      chatId,
      templateKey: key,
      body: text,
      wahaMessageId: result.id,
      participantId,
      productId: productId ?? null,
    });
    return 'sent';
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.challengeReminderLog.update({
      where: { participantId_key: { participantId, key } },
      data: { error: message },
    });
    await logWaSend({
      category: 'reminder',
      status: WaLogStatus.FAILED,
      chatId,
      templateKey: key,
      body: text,
      error: message,
      participantId,
      productId: productId ?? null,
    });
    console.error(`[challenge-reminders] send failed participant=${participantId} key=${key}:`, err);
    return 'failed';
  }
}

/**
 * D12 reminder worker (PRD §21.8). Scans active-challenge participants in AWAITING_INITIAL / RUNNING,
 * sends each due reminder once (reserve a ChallengeReminderLog row, then send — favors no double-send),
 * and auto-eliminates at H+15 (no initial) / day-105 (no final). Idempotent + safe to run hourly.
 */
export async function processDueChallengeReminders(now: Date = new Date()): Promise<{
  processed: number;
  sent: number;
  failed: number;
  eliminated: number;
}> {
  const participants = await db.challengeParticipant.findMany({
    where: {
      status: { in: [ParticipantStatus.AWAITING_INITIAL, ParticipantStatus.RUNNING] },
      challenge: { isActive: true },
    },
    include: { challenge: true, customer: true, reminders: true },
  });

  let sent = 0;
  let failed = 0;
  let eliminated = 0;

  for (const p of participants) {
    const c = p.challenge;
    const timing = {
      startWindowDays: c.startWindowDays,
      durationDays: c.durationDays,
      finalProofWindowDays: c.finalProofWindowDays,
      phases: (c.phases as ChallengePhase[]) ?? [],
    };
    const sentKeys = new Set(p.reminders.map(r => r.key));
    const templates = (c.messageTemplates as Record<string, string>) ?? {};

    const { send, drop } = computeDueReminders(
      { status: p.status, purchaseAt: p.purchaseAt, startAt: p.startAt, finalSubmittedAt: p.finalSubmittedAt },
      timing,
      sentKeys,
      now,
    );

    for (const key of send) {
      const tpl = templates[key];
      if (!tpl) continue; // no template configured for this trigger — skip

      const outcome = await sendChallengeReminderOnce({
        participantId: p.id,
        whatsapp: p.customer.whatsapp,
        key,
        template: tpl,
        contactInfo: c.contactInfo,
        productId: c.productId,
      });
      if (outcome === 'sent') sent++;
      else if (outcome === 'failed') failed++;

      // Space every actual send out (a 'skipped' = already sent elsewhere, so no message went out).
      if (outcome !== 'skipped') await sleep(interMessageGapMs());
    }

    if (drop) {
      await db.challengeParticipant.update({
        where: { id: p.id },
        data: { status: ParticipantStatus.DROPPED, dropReason: drop },
      });
      eliminated++;
    }
  }

  return { processed: participants.length, sent, failed, eliminated };
}
