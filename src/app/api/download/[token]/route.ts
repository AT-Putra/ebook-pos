import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { OrderStatus } from '@prisma/client';
import { normalizeIndonesianPhone } from '@/lib/phone';
import { readEbookAsBuffer } from '@/lib/files';
import { checkDownloadRateLimit, clientIpFromHeaders } from '@/lib/rate-limit';

// Public, protected e-book download (D16, §25). NOT under /admin — no session/bearer. The token is
// the secret; the buyer must additionally enter the WhatsApp number registered on the order, and
// wrong attempts are rate-limited (per token+IP). Streams the private PDF only on an exact match.
// Permanent + unlimited re-downloads while the order is PAID. Never a public/static URL (invariant #4).

type Props = { params: Promise<{ token: string }> };

const bodySchema = z.object({ whatsapp: z.string().min(1) });

export async function POST(req: NextRequest, { params }: Props) {
  const { token } = await params;

  // 1. Throttle wrong-number guessing (per token + IP) so a leaked link can't enumerate numbers.
  const ip = clientIpFromHeaders(req.headers);
  const rl = checkDownloadRateLimit(`${token}:${ip}`);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Terlalu banyak percobaan. Silakan coba lagi nanti.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
    );
  }

  // 2. Validate input.
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Nomor WhatsApp diperlukan.' }, { status: 400 });
  }

  // 3. Resolve the token → delivery → order (must be PAID).
  const delivery = await db.delivery.findUnique({
    where: { downloadToken: token },
    include: {
      items: true,
      order: { include: { customer: true, product: true } },
    },
  });
  if (!delivery) {
    return NextResponse.json({ error: 'Link tidak valid.' }, { status: 404 });
  }
  if (delivery.order.status !== OrderStatus.PAID) {
    return NextResponse.json({ error: 'Pembayaran untuk pesanan ini belum selesai.' }, { status: 403 });
  }

  // 4. Exact phone match against the order's registered number.
  let entered: string;
  try {
    entered = normalizeIndonesianPhone(parsed.data.whatsapp);
  } catch {
    return NextResponse.json({ error: 'Nomor tidak cocok dengan pesanan.' }, { status: 403 });
  }
  if (entered !== delivery.order.customer.whatsapp) {
    return NextResponse.json({ error: 'Nomor tidak cocok dengan pesanan.' }, { status: 403 });
  }

  // 5. Stream the e-book PDF — prefer the snapshotted DeliveryItem, fall back to the product.
  const ebookItem = delivery.items.find(i => i.kind === 'ebook');
  const filePath = ebookItem?.filePath ?? delivery.order.product.filePath;
  const fileName = ebookItem?.fileName ?? delivery.order.product.fileName;

  let buffer: Buffer;
  try {
    buffer = await readEbookAsBuffer(filePath);
  } catch {
    return NextResponse.json({ error: 'File e-book tidak dapat dibaca. Hubungi admin.' }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(buffer.length),
      'Content-Disposition': `attachment; filename="${fileName.replace(/"/g, '')}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
