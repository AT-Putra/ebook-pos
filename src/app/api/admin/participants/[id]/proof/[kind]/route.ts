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

  // Stream with HTTP Range support so the inline <video> player works in every browser
  // (Safari/iOS refuse to play without 206 partial responses) and seeking works.
  const total = buffer.length;
  const base: Record<string, string> = {
    'Content-Type': sub.mimeType ?? 'video/mp4',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, no-store',
    'Content-Disposition': `inline; filename="${kind}-proof.mp4"`,
  };

  const range = req.headers.get('range');
  const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
  if (match) {
    let start = match[1] ? parseInt(match[1], 10) : 0;
    let end = match[2] ? parseInt(match[2], 10) : total - 1;
    if (Number.isNaN(start)) start = 0;
    if (Number.isNaN(end) || end >= total) end = total - 1;
    if (start > end || start >= total) {
      return new NextResponse(null, { status: 416, headers: { ...base, 'Content-Range': `bytes */${total}` } });
    }
    const chunk = buffer.subarray(start, end + 1);
    return new NextResponse(new Uint8Array(chunk), {
      status: 206,
      headers: { ...base, 'Content-Range': `bytes ${start}-${end}/${total}`, 'Content-Length': String(chunk.length) },
    });
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: { ...base, 'Content-Length': String(total) },
  });
}
