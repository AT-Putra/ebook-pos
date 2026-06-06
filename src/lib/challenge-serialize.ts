import type { Prisma } from '@prisma/client';
import { participantView, type ChallengePhase, type ChallengeTimingLike } from './challenge';

export type ParticipantWithRelations = Prisma.ChallengeParticipantGetPayload<{
  include: { customer: true; submissions: true };
}>;

/** Serializes a participant (+ derived view) for the User/Active dashboard. */
export function serializeParticipant(p: ParticipantWithRelations, timing: ChallengeTimingLike) {
  const view = participantView(p, timing);
  return {
    id: p.id,
    customerName: p.customer.name,
    whatsapp: p.customer.whatsapp,
    status: p.status,
    displayStatus: view.displayStatus,
    group: view.group,
    dayOfChallenge: view.dayOfChallenge,
    phaseName: view.phaseName,
    finalOverdue: view.finalOverdue,
    startAt: p.startAt,
    purchaseAt: p.purchaseAt,
    initialWeightKg: p.initialWeightKg,
    finalWeightKg: p.finalWeightKg,
    percentLoss: view.percentLoss,
    dropReason: p.dropReason,
    notes: p.notes,
    hasInitialVideo: p.submissions.some(s => s.kind === 'initial' && !!s.mediaPath),
    hasFinalVideo: p.submissions.some(s => s.kind === 'final' && !!s.mediaPath),
  };
}

/** Pulls the timing fields out of a stored Challenge row (phases is JSON). */
export function challengeTiming(c: { durationDays: number; finalProofWindowDays: number; phases: unknown }): ChallengeTimingLike {
  return {
    durationDays: c.durationDays,
    finalProofWindowDays: c.finalProofWindowDays,
    phases: (c.phases as ChallengePhase[]) ?? [],
  };
}
