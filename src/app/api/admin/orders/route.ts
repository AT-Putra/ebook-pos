import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { OrderStatus } from '@prisma/client';

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const statusParam = req.nextUrl.searchParams.get('status');
  const statusFilter = statusParam
    ? Object.values(OrderStatus).includes(statusParam as OrderStatus)
      ? (statusParam as OrderStatus)
      : null
    : null;

  if (statusParam && !statusFilter) {
    return NextResponse.json({ error: `Invalid status: ${statusParam}` }, { status: 400 });
  }

  const orders = await db.order.findMany({
    where: statusFilter ? { status: statusFilter } : undefined,
    orderBy: { createdAt: 'desc' },
    include: {
      customer: { select: { name: true, email: true, whatsapp: true } },
      product: { select: { name: true, slug: true } },
      delivery: {
        select: { status: true, attempts: true, lastError: true, sentAt: true, nextRetryAt: true },
      },
    },
  });

  return NextResponse.json({ orders });
}
