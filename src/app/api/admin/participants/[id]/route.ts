import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { ParticipantStatus } from '@prisma/client';
import { percentLoss } from '@/lib/challenge';
import { serializeParticipant, challengeTiming } from '@/lib/challenge-serialize';

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
    include: { challenge: true, submissions: true },
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
