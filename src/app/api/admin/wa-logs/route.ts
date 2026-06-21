import { NextRequest, NextResponse } from 'next/server';
import { Prisma, WaLogStatus } from '@prisma/client';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';

const CATEGORIES = ['ebook', 'attachment', 'reminder'] as const;
const MAX_ROWS = 2000; // safety cap — the table is paginated/searched client-side

/** WIB (UTC+7) inclusive day bounds for a YYYY-MM-DD string. */
function wibBounds(dateStr: string, edge: 'start' | 'end'): Date {
  return new Date(`${dateStr}T${edge === 'start' ? '00:00:00.000' : '23:59:59.999'}+07:00`);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const where: Prisma.WaMessageLogWhereInput = {};

  const status = sp.get('status');
  if (status) {
    if (!Object.values(WaLogStatus).includes(status as WaLogStatus)) {
      return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
    }
    where.status = status as WaLogStatus;
  }

  const category = sp.get('category');
  if (category) {
    if (!CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
      return NextResponse.json({ error: `Invalid category: ${category}` }, { status: 400 });
    }
    where.category = category;
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
      { toPhone: { contains: q } },
      { chatId: { contains: q } },
      { wahaMessageId: { contains: q } },
      { fileName: { contains: q, mode: 'insensitive' } },
      { templateKey: { contains: q, mode: 'insensitive' } },
    ];
  }

  const logs = await db.waMessageLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: MAX_ROWS,
  });

  // Enrich delivery rows with their order code (logs are FK-decoupled; batch the lookup).
  const orderIds = [...new Set(logs.map(l => l.orderId).filter((x): x is string => !!x))];
  const orders = orderIds.length
    ? await db.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, orderCode: true } })
    : [];
  const orderCodeById = new Map(orders.map(o => [o.id, o.orderCode]));

  const rows = logs.map(l => ({
    id: l.id,
    createdAt: l.createdAt.toISOString(),
    category: l.category,
    status: l.status,
    chatId: l.chatId,
    toPhone: l.toPhone,
    templateKey: l.templateKey,
    fileName: l.fileName,
    bodyPreview: l.bodyPreview,
    wahaMessageId: l.wahaMessageId,
    error: l.error,
    orderId: l.orderId,
    orderCode: l.orderId ? orderCodeById.get(l.orderId) ?? null : null,
    deliveryId: l.deliveryId,
    productId: l.productId,
  }));

  return NextResponse.json({ rows });
}
