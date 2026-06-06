import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { defaultChallengeConfig } from '@/lib/challenge';

type Props = { params: Promise<{ productId: string }> };

const phaseSchema = z.object({
  name: z.string().min(1),
  focus: z.string().default(''),
  startDay: z.number().int().min(1),
  endDay: z.number().int().min(1),
});
const tierSchema = z.object({
  label: z.string().min(1),
  prize: z.string().min(1),
  count: z.number().int().min(0),
});
const configSchema = z.object({
  isActive: z.boolean(),
  startWindowDays: z.number().int().min(1),
  durationDays: z.number().int().min(1),
  finalProofWindowDays: z.number().int().min(0),
  videoMaxSeconds: z.number().int().min(1),
  videoMaxSizeMb: z.number().int().min(1),
  videoFormat: z.string().min(1),
  phases: z.array(phaseSchema).min(1),
  rewardsText: z.string().optional().default(''),
  winnerTiers: z.array(tierSchema),
  contactInfo: z.string().optional().default(''),
  messageTemplates: z.record(z.string(), z.string()),
});

export async function GET(req: NextRequest, { params }: Props) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const { productId } = await params;
  const product = await db.product.findUnique({ where: { id: productId } });
  if (!product) {
    return NextResponse.json({ error: 'Program tidak ditemukan.' }, { status: 404 });
  }
  const challenge = await db.challenge.findUnique({ where: { productId } });
  return NextResponse.json({ challenge, defaults: defaultChallengeConfig() });
}

export async function PUT(req: NextRequest, { params }: Props) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const { productId } = await params;
  const product = await db.product.findUnique({ where: { id: productId } });
  if (!product) {
    return NextResponse.json({ error: 'Program tidak ditemukan.' }, { status: 404 });
  }

  const parsed = configSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validasi gagal.', issues: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`) },
      { status: 422 },
    );
  }
  const d = parsed.data;
  const data = {
    isActive: d.isActive,
    startWindowDays: d.startWindowDays,
    durationDays: d.durationDays,
    finalProofWindowDays: d.finalProofWindowDays,
    videoMaxSeconds: d.videoMaxSeconds,
    videoMaxSizeMb: d.videoMaxSizeMb,
    videoFormat: d.videoFormat,
    phases: d.phases,
    rewardsText: d.rewardsText,
    winnerTiers: d.winnerTiers,
    contactInfo: d.contactInfo,
    messageTemplates: d.messageTemplates,
  };

  const challenge = await db.challenge.upsert({
    where: { productId },
    update: data,
    create: { productId, ...data },
  });
  return NextResponse.json({ challenge });
}
