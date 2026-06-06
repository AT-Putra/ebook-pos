import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { sendTextHumanized } from '@/lib/waha';
import { normalizeIndonesianPhone, toChatId, PhoneNormalizationError } from '@/lib/phone';

const bodySchema = z.object({
  whatsapp: z.string().min(1),
  text: z.string().min(1).max(4000),
});

/** Sends a one-off test WhatsApp message to a number (e.g. to preview a challenge
 *  reminder template). Uses the humanized send sequence (§12.2.1). requireAdmin. */
export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Nomor dan teks diperlukan.' }, { status: 400 });
  }

  let normalized: string;
  try {
    normalized = normalizeIndonesianPhone(parsed.data.whatsapp);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof PhoneNormalizationError ? err.message : 'Nomor WhatsApp tidak valid.' },
      { status: 422 },
    );
  }

  try {
    const result = await sendTextHumanized({ chatId: toChatId(normalized), text: parsed.data.text });
    return NextResponse.json({ ok: true, messageId: result.id });
  } catch (err) {
    return NextResponse.json(
      { error: `Gagal mengirim: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    );
  }
}
