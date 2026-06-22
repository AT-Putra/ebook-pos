import { NextRequest, NextResponse } from 'next/server';
import { Prisma, OrderStatus } from '@prisma/client';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';

const MAX_ROWS = 5000; // safety cap — the table paginates/searches client-side
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** WIB (UTC+7) inclusive day bound for a YYYY-MM-DD string. */
function wibBounds(dateStr: string, edge: 'start' | 'end'): Date {
  return new Date(`${dateStr}T${edge === 'start' ? '00:00:00.000' : '23:59:59.999'}+07:00`);
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const where: Prisma.OrderWhereInput = {};

  const status = sp.get('status');
  if (status) {
    if (!Object.values(OrderStatus).includes(status as OrderStatus)) {
      return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
    }
    where.status = status as OrderStatus;
  }

  const programId = sp.get('programId');
  if (programId) where.productId = programId;

  const from = sp.get('from');
  const to = sp.get('to');
  if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) {
    return NextResponse.json({ error: 'Invalid date (expected YYYY-MM-DD).' }, { status: 400 });
  }
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = wibBounds(from, 'start');
    if (to) where.createdAt.lte = wibBounds(to, 'end');
  }

  const q = sp.get('q')?.trim();
  if (q) {
    where.OR = [
      { orderCode: { contains: q, mode: 'insensitive' } },
      { trackingId: { contains: q, mode: 'insensitive' } },
      { customer: { is: { name: { contains: q, mode: 'insensitive' } } } },
      { customer: { is: { email: { contains: q, mode: 'insensitive' } } } },
      { customer: { is: { whatsapp: { contains: q } } } },
    ];
  }

  const orders = await db.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: MAX_ROWS,
    include: {
      customer: { select: { name: true, email: true, whatsapp: true } },
      product: { select: { name: true, programName: true } },
      delivery: { select: { id: true, status: true, attempts: true, lastError: true, sentAt: true } },
    },
  });

  const rows = orders.map(o => ({
    id: o.id,
    orderCode: o.orderCode,
    createdAt: o.createdAt.toISOString(),
    paidAt: o.paidAt?.toISOString() ?? null,
    customerName: o.customer.name,
    email: o.customer.email,
    whatsapp: o.customer.whatsapp,
    productId: o.productId,
    productName: o.product.name,
    programName: o.product.programName,
    amountIdr: o.amountIdr,
    status: o.status,
    trackingId: o.trackingId,
    paymentType: o.paymentType,
    deliveryId: o.delivery?.id ?? null,
    deliveryStatus: o.delivery?.status ?? null,
    deliveryAttempts: o.delivery?.attempts ?? null,
    deliveryLastError: o.delivery?.lastError ?? null,
    deliverySentAt: o.delivery?.sentAt?.toISOString() ?? null,
  }));

  return NextResponse.json({ rows });
}
