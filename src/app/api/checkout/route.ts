import { NextRequest, NextResponse } from 'next/server';
import { OrderStatus } from '@prisma/client';
import { checkoutSchema } from '@/lib/validation';
import { db } from '@/lib/db';
import { createPendingOrder } from '@/lib/orders';
import { createSnapTransaction } from '@/lib/midtrans';
import { toChatId } from '@/lib/phone';
import { corsHeadersFor } from '@/lib/cors';
import { checkRateLimit, clientIpFromHeaders } from '@/lib/rate-limit';

/** CORS preflight: allow only origins on the AllowedOrigin whitelist (or the app's own). */
export async function OPTIONS(req: NextRequest) {
  const cors = await corsHeadersFor(req.headers.get('origin'));
  if (!cors['Access-Control-Allow-Origin']) {
    return new NextResponse(null, { status: 403 });
  }
  return new NextResponse(null, { status: 204, headers: cors });
}

export async function POST(req: NextRequest) {
  // CORS: cross-origin browsers only get a readable response if their origin is
  // whitelisted. Same-origin / server-side callers (no Origin header) are unaffected.
  const cors = await corsHeadersFor(req.headers.get('origin'));

  const json = (body: unknown, status = 200) =>
    NextResponse.json(body, { status, headers: cors });

  // Rate limit (per IP; configurable + disableable in the Pengaturan menu).
  const rl = await checkRateLimit(clientIpFromHeaders(req.headers));
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Terlalu banyak permintaan. Silakan coba lagi sebentar lagi.' },
      { status: 429, headers: { ...cors, 'Retry-After': String(rl.retryAfter) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Request body harus JSON.' }, 400);
  }

  // 1. Validate input.
  const result = checkoutSchema.safeParse(body);
  if (!result.success) {
    const fields: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0]?.toString() ?? '_';
      fields[key] = [...(fields[key] ?? []), issue.message];
    }
    return json({ error: 'Validasi gagal.', fields }, 422);
  }

  const { productSlug, name, email, whatsapp, trackingId } = result.data;

  // 2. Look up active product.
  const product = await db.product.findUnique({ where: { slug: productSlug } });
  if (!product || !product.isActive) {
    return json({ error: 'Produk tidak ditemukan.' }, 404);
  }

  // 3. Upsert customer (by normalised whatsapp + email).
  const customer = await db.customer.upsert({
    where: { email_whatsapp: { email, whatsapp } },
    update: { name },
    create: { name, email, whatsapp },
  });

  // 4. Create order (PENDING) — retries on the improbable orderCode collision.
  const order = await createPendingOrder({
    customerId: customer.id,
    productId: product.id,
    amountIdr: product.priceIdr,
    trackingId: trackingId ?? null,
  });
  const orderCode = order.orderCode;

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
    return json({ error: 'Gagal membuat transaksi pembayaran. Silakan coba lagi.' }, 502);
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
  return json({
    orderCode,
    snapToken: snap.token,
    redirectUrl: snap.redirect_url,
  });
}
