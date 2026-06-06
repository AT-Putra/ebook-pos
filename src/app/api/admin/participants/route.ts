import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { serializeParticipant, challengeTiming } from '@/lib/challenge-serialize';

const GROUPS = ['pending', 'active', 'completed', 'dropped'] as const;

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const programId = req.nextUrl.searchParams.get('programId');
  const group = req.nextUrl.searchParams.get('group');
  if (!programId) {
    return NextResponse.json({ error: 'programId diperlukan.' }, { status: 400 });
  }

  const challenge = await db.challenge.findUnique({ where: { productId: programId } });
  if (!challenge) {
    return NextResponse.json({ participants: [] });
  }

  const participants = await db.challengeParticipant.findMany({
    where: { challengeId: challenge.id },
    orderBy: { createdAt: 'desc' },
    include: { customer: true, submissions: true },
  });

  const timing = challengeTiming(challenge);
  let serialized = participants.map(p => serializeParticipant(p, timing));
  if (group && (GROUPS as readonly string[]).includes(group)) {
    serialized = serialized.filter(p => p.group === group);
  }

  return NextResponse.json({ participants: serialized });
}
