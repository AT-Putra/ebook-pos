import { NextRequest, NextResponse } from 'next/server';
import { OrderStatus } from '@prisma/client';
import { checkoutSchema } from '@/lib/validation';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { createPendingOrder, decideCheckoutAction, shouldSetTracking, renewOrderForPayment } from '@/lib/orders';
import { createSnapTransaction } from '@/lib/midtrans';
import { toChatId } from '@/lib/phone';
import { corsHeadersFor } from '@/lib/cors';
import { checkRateLimit, clientIpFromHeaders } from '@/lib/rate-limit';
import { isOnSale } from '@/lib/programs';

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

  // 2b. Enforce the sales window — once a program's period ends (or before it starts),
  // the e-book can no longer be bought (authoritative server gate, PRD §20.11).
  if (!isOnSale(product)) {
    return json({ error: 'Penjualan untuk produk ini sedang ditutup.' }, 403);
  }

  // 3. Upsert customer (by normalised whatsapp + email).
  const customer = await db.customer.upsert({
    where: { email_whatsapp: { email, whatsapp } },
    update: { name },
    create: { name, email, whatsapp },
  });

  // Snap helper — shared by the new-order, renew, and continue paths. SERVER KEY NEVER LEAVES THE SERVER.
  const issueSnap = (orderCode: string) =>
    createSnapTransaction({
      orderId: orderCode,
      grossAmount: product.priceIdr,
      productId: product.id,
      productName: product.name,
      customerName: name,
      customerEmail: email,
      customerPhone: toChatId(whatsapp).replace('@c.us', ''), // digits only for Midtrans
    });

  // 4. Dedup (D18, §27): reuse the existing lead for this customer + product instead of duplicating.
  const existingOrders = await db.order.findMany({
    where: { customerId: customer.id, productId: product.id },
    orderBy: { createdAt: 'desc' },
  });
  const decision = decideCheckoutAction(existingOrders);

  // 4a. Already purchased → status page (don't touch the order; avoids retro conversion attribution).
  if (decision.kind === 'already_paid') {
    const base = env.APP_BASE_URL.replace(/\/+$/, '');
    return json({
      alreadyPaid: true,
      orderCode: decision.order.orderCode,
      paidAt: decision.order.paidAt,
      redirectUrl: `${base}/thank-you?order_id=${encodeURIComponent(decision.order.orderCode)}`,
    });
  }

  // 4b. Pending with a payment URL → resume it. trackingId set only if previously empty.
  if (decision.kind === 'continue') {
    if (shouldSetTracking(decision.order.trackingId, trackingId)) {
      await db.order.update({ where: { id: decision.order.id }, data: { trackingId: trackingId!.trim() } });
    }
    return json({
      orderCode: decision.order.orderCode,
      snapToken: decision.order.snapToken,
      redirectUrl: decision.order.snapRedirectUrl,
    });
  }

  // 4c. Expired (or pending w/o URL) → new Midtrans transaction on the SAME lead row.
  if (decision.kind === 'renew') {
    if (shouldSetTracking(decision.order.trackingId, trackingId)) {
      await db.order.update({ where: { id: decision.order.id }, data: { trackingId: trackingId!.trim() } });
    }
    const newCode = await renewOrderForPayment(decision.order.id, product.priceIdr);
    let snap;
    try {
      snap = await issueSnap(newCode);
    } catch (err) {
      await db.order.update({ where: { id: decision.order.id }, data: { status: OrderStatus.FAILED } });
      console.error('[checkout] Midtrans Snap error (renew):', err);
      return json({ error: 'Gagal membuat transaksi pembayaran. Silakan coba lagi.' }, 502);
    }
    await db.order.update({
      where: { id: decision.order.id },
      data: { snapToken: snap.token, snapRedirectUrl: snap.redirect_url },
    });
    return json({ orderCode: newCode, snapToken: snap.token, redirectUrl: snap.redirect_url });
  }

  // 4d. No reusable lead → create a fresh order (the original flow).
  const order = await createPendingOrder({
    customerId: customer.id,
    productId: product.id,
    amountIdr: product.priceIdr,
    trackingId: trackingId ?? null,
  });
  const orderCode = order.orderCode;

  let snap;
  try {
    snap = await issueSnap(orderCode);
  } catch (err) {
    await db.order.update({ where: { id: order.id }, data: { status: OrderStatus.FAILED } });
    console.error('[checkout] Midtrans Snap error:', err);
    return json({ error: 'Gagal membuat transaksi pembayaran. Silakan coba lagi.' }, 502);
  }

  await db.order.update({
    where: { id: order.id },
    data: { snapToken: snap.token, snapRedirectUrl: snap.redirect_url },
  });

  return json({ orderCode, snapToken: snap.token, redirectUrl: snap.redirect_url });
}
