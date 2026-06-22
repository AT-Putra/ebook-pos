import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { ParticipantStatus, Prisma } from '@prisma/client';
import { percentLoss, renderTemplate } from '@/lib/challenge';
import { serializeParticipant, challengeTiming } from '@/lib/challenge-serialize';
import { getWaEngine } from '@/lib/messaging';

type Props = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  action: z.enum(['verify_initial', 'verify_final', 'reject_initial', 'reject_final', 'drop', 'note']),
  initialWeightKg: z.number().positive().optional(),
  finalWeightKg: z.number().positive().optional(),
  dropReason: z.string().max(300).optional(),
  rejectedReason: z.string().max(300).optional(),
  notes: z.string().max(2000).optional(),
});

export async function PATCH(req: NextRequest, { params }: Props) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const { id } = await params;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Body tidak valid.' }, { status: 400 });
  }
  const b = parsed.data;

  const participant = await db.challengeParticipant.findUnique({
    where: { id },
    include: { challenge: true, submissions: true, customer: true },
  });
  if (!participant) {
    return NextResponse.json({ error: 'Peserta tidak ditemukan.' }, { status: 404 });
  }

  const latest = (kind: 'initial' | 'final') =>
    participant.submissions
      .filter(s => s.kind === kind)
      .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime())[0];

  switch (b.action) {
    case 'verify_initial': {
      if (b.initialWeightKg == null) {
        return NextResponse.json({ error: 'Berat awal (kg) diperlukan.' }, { status: 422 });
      }
      const sub = latest('initial');
      await db.challengeParticipant.update({
        where: { id },
        data: {
          status: ParticipantStatus.RUNNING,
          startAt: sub?.receivedAt ?? new Date(),
          initialWeightKg: b.initialWeightKg,
        },
      });
      if (sub) await db.challengeSubmission.update({ where: { id: sub.id }, data: { verifiedAt: new Date(), rejectedReason: null } });
      break;
    }
    case 'verify_final': {
      if (b.finalWeightKg == null) {
        return NextResponse.json({ error: 'Berat akhir (kg) diperlukan.' }, { status: 422 });
      }
      if (participant.initialWeightKg == null) {
        return NextResponse.json({ error: 'Verifikasi bukti awal dulu (berat awal belum ada).' }, { status: 422 });
      }
      const sub = latest('final');
      await db.challengeParticipant.update({
        where: { id },
        data: {
          status: ParticipantStatus.COMPLETED,
          finalWeightKg: b.finalWeightKg,
          finalSubmittedAt: sub?.receivedAt ?? new Date(),
          percentLoss: percentLoss(participant.initialWeightKg, b.finalWeightKg),
        },
      });
      if (sub) await db.challengeSubmission.update({ where: { id: sub.id }, data: { verifiedAt: new Date(), rejectedReason: null } });
      // Send the "final proof received / completed" confirmation once (best-effort, idempotent).
      await sendFinalReceived(participant);
      break;
    }
    case 'reject_initial': {
      const sub = latest('initial');
      if (sub) await db.challengeSubmission.update({ where: { id: sub.id }, data: { rejectedReason: b.rejectedReason ?? 'ditolak' } });
      break;
    }
    case 'reject_final': {
      const sub = latest('final');
      if (sub) await db.challengeSubmission.update({ where: { id: sub.id }, data: { rejectedReason: b.rejectedReason ?? 'ditolak' } });
      // Back to RUNNING so the participant can resend the final proof.
      await db.challengeParticipant.update({ where: { id }, data: { status: ParticipantStatus.RUNNING } });
      break;
    }
    case 'drop': {
      await db.challengeParticipant.update({
        where: { id },
        data: { status: ParticipantStatus.DROPPED, dropReason: b.dropReason ?? 'disqualified' },
      });
      break;
    }
    case 'note': {
      await db.challengeParticipant.update({ where: { id }, data: { notes: b.notes ?? null } });
      break;
    }
  }

  const updated = await db.challengeParticipant.findUniqueOrThrow({
    where: { id },
    include: { customer: true, submissions: true },
  });
  return NextResponse.json({ participant: serializeParticipant(updated, challengeTiming(participant.challenge)) });
}

type FinalReceivedParticipant = Prisma.ChallengeParticipantGetPayload<{ include: { challenge: true; customer: true } }>;

/** Sends the "bukti akhir diterima / selesai" confirmation once (best-effort; never blocks the verify). */
async function sendFinalReceived(p: FinalReceivedParticipant): Promise<void> {
  const templates = (p.challenge.messageTemplates as Record<string, string>) ?? {};
  const tpl = templates['final_received'];
  if (!tpl) return;
  try {
    await db.challengeReminderLog.create({ data: { participantId: p.id, key: 'final_received' } });
  } catch {
    return; // already sent (P2002) or transient — don't resend / don't block
  }
  try {
    const engine = await getWaEngine();
    const result = await engine.sendText({ phone: p.customer.whatsapp, text: renderTemplate(tpl, p.challenge.contactInfo) });
    await db.challengeReminderLog.update({
      where: { participantId_key: { participantId: p.id, key: 'final_received' } },
      data: { wahaMessageId: result.id },
    });
  } catch (err) {
    await db.challengeReminderLog
      .update({ where: { participantId_key: { participantId: p.id, key: 'final_received' } }, data: { error: err instanceof Error ? err.message : String(err) } })
      .catch(() => {});
  }
}
