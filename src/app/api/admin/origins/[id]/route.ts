import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';

type Props = { params: Promise<{ id: string }> };

const patchSchema = z.object({ isActive: z.boolean() });

export async function PATCH(req: NextRequest, { params }: Props) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'isActive (boolean) diperlukan.' }, { status: 400 });
  }
  try {
    const origin = await db.allowedOrigin.update({
      where: { id },
      data: { isActive: parsed.data.isActive },
    });
    return NextResponse.json({ origin });
  } catch {
    return NextResponse.json({ error: 'Origin tidak ditemukan.' }, { status: 404 });
  }
}

export async function DELETE(req: NextRequest, { params }: Props) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const { id } = await params;
  try {
    await db.allowedOrigin.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Origin tidak ditemukan.' }, { status: 404 });
  }
}
