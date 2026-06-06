import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { readChallengeMedia } from '@/lib/files';

type Props = { params: Promise<{ id: string; kind: string }> };

// Streams a participant's private proof video to an authenticated admin ONLY.
// Never a public URL (invariant #4).
export async function GET(req: NextRequest, { params }: Props) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const { id, kind } = await params;
  if (kind !== 'initial' && kind !== 'final') {
    return NextResponse.json({ error: 'kind harus initial atau final.' }, { status: 400 });
  }

  const sub = await db.challengeSubmission.findFirst({
    where: { participantId: id, kind, mediaPath: { not: null } },
    orderBy: { receivedAt: 'desc' },
  });
  if (!sub || !sub.mediaPath) {
    return NextResponse.json({ error: 'Video tidak ditemukan.' }, { status: 404 });
  }

  let buffer: Buffer;
  try {
    buffer = await readChallengeMedia(sub.mediaPath);
  } catch {
    return NextResponse.json({ error: 'File video tidak dapat dibaca.' }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': sub.mimeType ?? 'video/mp4',
      'Content-Length': String(buffer.length),
      'Cache-Control': 'private, no-store',
      'Content-Disposition': `inline; filename="${kind}-proof.mp4"`,
    },
  });
}
