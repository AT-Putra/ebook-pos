import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { normalizeOrigin } from '@/lib/cors';

const createSchema = z.object({
  origin: z.string().min(1),
  label: z.string().max(120).optional(),
});

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const origins = await db.allowedOrigin.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ origins });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Origin diperlukan.' }, { status: 400 });
  }

  const normalized = normalizeOrigin(parsed.data.origin);
  if (!normalized) {
    return NextResponse.json(
      { error: 'Format origin tidak valid. Contoh: https://landing.contoh.com' },
      { status: 422 },
    );
  }

  try {
    const origin = await db.allowedOrigin.create({
      data: { origin: normalized, label: parsed.data.label ?? null },
    });
    return NextResponse.json({ origin }, { status: 201 });
  } catch {
    // Unique violation → already whitelisted.
    return NextResponse.json({ error: 'Origin sudah ada di daftar.' }, { status: 409 });
  }
}
