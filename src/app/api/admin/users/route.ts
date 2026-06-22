import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, currentAdminUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { createUserSchema, serializeAdminUser } from '@/lib/admin-users';

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const [users, me] = await Promise.all([
    db.adminUser.findMany({ orderBy: { createdAt: 'asc' } }),
    currentAdminUser(req),
  ]);
  return NextResponse.json({
    users: users.map(serializeAdminUser),
    currentUserId: me?.id ?? null,
  });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const parsed = createUserSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Input tidak valid.';
    return NextResponse.json({ error: msg }, { status: 422 });
  }

  const { username, name, password } = parsed.data;
  const passwordHash = await hashPassword(password);

  try {
    const user = await db.adminUser.create({ data: { username, name, passwordHash } });
    return NextResponse.json({ user: serializeAdminUser(user) }, { status: 201 });
  } catch {
    // Unique violation on username.
    return NextResponse.json({ error: 'Username sudah dipakai.' }, { status: 409 });
  }
}
