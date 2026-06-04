import { NextRequest, NextResponse } from 'next/server';
import { OrderStatus } from '@prisma/client';
import { checkoutSchema } from '@/lib/validation';
import { db } from '@/lib/db';
import { generateOrderCode } from '@/lib/orders';
import { createSnapTransaction } from '@/lib/midtrans';
import { toChatId } from '@/lib/phone';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body harus JSON.' }, { status: 400 });
  }

  // 1. Validate input.
  const result = checkoutSchema.safeParse(body);
  if (!result.success) {
    const fields: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0]?.toString() ?? '_';
      fields[key] = [...(fields[key] ?? []), issue.message];
    }
    return NextResponse.json({ error: 'Validasi gagal.', fields }, { status: 422 });
  }

  const { productSlug, name, email, whatsapp, trackingId } = result.data;

  // 2. Look up active product.
  const product = await db.product.findUnique({ where: { slug: productSlug } });
  if (!product || !product.isActive) {
    return NextResponse.json({ error: 'Produk tidak ditemukan.' }, { status: 404 });
  }

  // 3. Upsert customer (by normalised whatsapp + email).
  const customer = await db.customer.upsert({
    where: { email_whatsapp: { email, whatsapp } },
    update: { name },
    create: { name, email, whatsapp },
  });

  // 4. Create order (PENDING).
  const orderCode = generateOrderCode();
  const order = await db.order.create({
    data: {
      orderCode,
      customerId: customer.id,
      productId: product.id,
      amountIdr: product.priceIdr,
      trackingId: trackingId ?? null,
      status: OrderStatus.PENDING,
    },
  });

  // 5. Create Midtrans Snap transaction.
  // On failure: mark order FAILED (keeps audit trail) and return 502.
  let snap;
  try {
    snap = await createSnapTransaction({
      orderId: orderCode,
      grossAmount: product.priceIdr,
      productId: product.id,
      productName: product.name,
      customerName: name,
      customerEmail: email,
      customerPhone: toChatId(whatsapp).replace('@c.us', ''), // digits only for Midtrans
    });
  } catch (err) {
    await db.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.FAILED },
    });
    console.error('[checkout] Midtrans Snap error:', err);
    return NextResponse.json(
      { error: 'Gagal membuat transaksi pembayaran. Silakan coba lagi.' },
      { status: 502 },
    );
  }

  // 6. Store snap token on the order.
  await db.order.update({
    where: { id: order.id },
    data: {
      snapToken: snap.token,
      snapRedirectUrl: snap.redirect_url,
    },
  });

  // 7. Return token to client — SERVER KEY NEVER LEAVES THE SERVER.
  return NextResponse.json({
    orderCode,
    snapToken: snap.token,
    redirectUrl: snap.redirect_url,
  });
}
