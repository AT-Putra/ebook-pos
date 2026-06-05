import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { getRateLimitConfig, clearRateLimitConfigCache } from '@/lib/rate-limit';

const putSchema = z.object({
  enabled: z.boolean(),
  maxRequests: z.number().int().min(1).max(10_000),
  windowSeconds: z.number().int().min(1).max(3_600),
});

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  return NextResponse.json({ config: await getRateLimitConfig() });
}

export async function PUT(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const parsed = putSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'enabled (boolean), maxRequests (1–10000), windowSeconds (1–3600) diperlukan.' },
      { status: 400 },
    );
  }

  const { enabled, maxRequests, windowSeconds } = parsed.data;
  const config = await db.rateLimitConfig.upsert({
    where: { id: 'default' },
    create: { id: 'default', enabled, maxRequests, windowSeconds },
    update: { enabled, maxRequests, windowSeconds },
  });
  clearRateLimitConfigCache(); // apply immediately

  return NextResponse.json({
    config: {
      enabled: config.enabled,
      maxRequests: config.maxRequests,
      windowSeconds: config.windowSeconds,
    },
  });
}
