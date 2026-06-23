import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { getConversionConfig, clearConversionConfigCache, validatePostbackUrl } from '@/lib/conversion';

// Ad-publisher conversion postback config (D17, §26). The postback URL is not a secret — stored in
// the DB and shown in Pengaturan. trxid = Order.trackingId (reused; no new field).

const putSchema = z.object({
  enabled: z.boolean(),
  postbackUrl: z.string().trim().max(2000).optional().default(''),
});

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  return NextResponse.json({ config: await getConversionConfig() });
}

export async function PUT(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const parsed = putSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'enabled (boolean) dan postbackUrl diperlukan.' }, { status: 400 });
  }

  const enabled = parsed.data.enabled;
  const postbackUrl = parsed.data.postbackUrl.trim();

  // A URL is required to enable; validate its format (https + must contain {trxid}).
  if (enabled || postbackUrl.length > 0) {
    if (postbackUrl.length === 0) {
      return NextResponse.json({ error: 'URL postback diperlukan untuk mengaktifkan.' }, { status: 422 });
    }
    const v = validatePostbackUrl(postbackUrl);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 422 });
  }

  const config = await db.conversionConfig.upsert({
    where: { id: 'default' },
    create: { id: 'default', enabled, postbackUrl: postbackUrl || null },
    update: { enabled, postbackUrl: postbackUrl || null },
  });
  clearConversionConfigCache(); // apply immediately

  return NextResponse.json({ config: { enabled: config.enabled, postbackUrl: config.postbackUrl } });
}
