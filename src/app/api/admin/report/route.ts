import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/session';
import { COOKIE_NAME } from '@/lib/session';
import { isAdmin } from '@/lib/auth';
import { getReport } from '@/lib/report';

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

async function isAuthenticated(req: NextRequest): Promise<boolean> {
  if (isAdmin(req)) return true;
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return false;
  const user = await validateSession(token);
  return user !== null;
}

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated(req))) {
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

  const data = await getReport(from, to);
  return NextResponse.json(data);
}
