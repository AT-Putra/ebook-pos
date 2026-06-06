import { Prisma, ParticipantStatus } from '@prisma/client';
import { db } from './db';
import { computeDueReminders, renderTemplate, type ChallengePhase } from './challenge';
import { sendTextHumanized } from './waha';
import { toChatId } from './phone';

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

      // Reserve the slot first (idempotent): if it already exists, another run sent it.
      try {
        await db.challengeReminderLog.create({ data: { participantId: p.id, key } });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') continue;
        throw err;
      }

      try {
        const text = renderTemplate(tpl, c.contactInfo);
        const result = await sendTextHumanized({ chatId: toChatId(p.customer.whatsapp), text });
        await db.challengeReminderLog.update({
          where: { participantId_key: { participantId: p.id, key } },
          data: { wahaMessageId: result.id },
        });
        sent++;
      } catch (err) {
        await db.challengeReminderLog.update({
          where: { participantId_key: { participantId: p.id, key } },
          data: { error: err instanceof Error ? err.message : String(err) },
        });
        failed++;
        console.error(`[challenge-reminders] send failed participant=${p.id} key=${key}:`, err);
      }
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
