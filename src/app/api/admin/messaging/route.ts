import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  getActiveEngineName,
  clearMessagingConfigCache,
  isFonnteConfigured,
  isFonnteWebhookConfigured,
} from '@/lib/messaging';

// Active WhatsApp engine selector (slice D15, §24.5). The Fonnte token is a server-only env var —
// it is NEVER returned here (invariant #6); only booleans describing whether the env is configured.

const putSchema = z.object({
  engine: z.enum(['waha', 'fonnte']),
});

async function payload() {
  return {
    engine: await getActiveEngineName(),
    fonnteConfigured: isFonnteConfigured(),
    fonnteWebhookConfigured: isFonnteWebhookConfigured(),
  };
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  return NextResponse.json({ config: await payload() });
}

export async function PUT(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const parsed = putSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "engine harus 'waha' atau 'fonnte'." }, { status: 400 });
  }

  const { engine } = parsed.data;
  await db.messagingConfig.upsert({
    where: { id: 'default' },
    create: { id: 'default', engine },
    update: { engine },
  });
  clearMessagingConfigCache(); // apply immediately (don't wait out the 10s cache)

  return NextResponse.json({ config: await payload() });
}
