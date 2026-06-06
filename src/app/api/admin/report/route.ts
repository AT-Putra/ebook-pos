import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { getReport } from '@/lib/report';

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  programId: z.string().min(1).optional(), // filter metrics to one program (productId)
});

const MAX_RANGE_DAYS = 366;

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const params = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Parameter from dan to diperlukan (YYYY-MM-DD).' }, { status: 400 });
  }

  const { from, to } = parsed.data;
  if (from > to) {
    return NextResponse.json({ error: 'from harus sebelum atau sama dengan to.' }, { status: 400 });
  }

  const days =
    Math.round(
      (new Date(`${to}T00:00:00+07:00`).getTime() - new Date(`${from}T00:00:00+07:00`).getTime()) /
        86_400_000,
    ) + 1;
  if (days > MAX_RANGE_DAYS) {
    return NextResponse.json(
      { error: `Rentang tanggal maksimal ${MAX_RANGE_DAYS} hari.` },
      { status: 400 },
    );
  }

  const data = await getReport(from, to, parsed.data.programId);
  return NextResponse.json(data);
}
