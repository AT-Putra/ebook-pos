import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, currentAdminUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { updateUserSchema, serializeAdminUser, deactivationBlock } from '@/lib/admin-users';

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const { id } = await ctx.params;

  const parsed = updateUserSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Input tidak valid.';
    return NextResponse.json({ error: msg }, { status: 422 });
  }

  const target = await db.adminUser.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: 'Akun tidak ditemukan.' }, { status: 404 });
  }

  const { name, password, isActive } = parsed.data;

  // Anti-lockout: block disabling yourself or the last active admin.
  if (isActive === false && target.isActive) {
    const me = await currentAdminUser(req);
    const activeCount = await db.adminUser.count({ where: { isActive: true } });
    const block = deactivationBlock(target.id, me?.id ?? null, activeCount);
    if (block) {
      return NextResponse.json({ error: block }, { status: 422 });
    }
  }

  const data: { name?: string; passwordHash?: string; isActive?: boolean } = {};
  if (name !== undefined) data.name = name;
  if (password !== undefined) data.passwordHash = await hashPassword(password);
  if (isActive !== undefined) data.isActive = isActive;

  const user = await db.adminUser.update({ where: { id }, data });

  // Revoke sessions on deactivation → forced logout everywhere.
  if (isActive === false && target.isActive) {
    await db.session.deleteMany({ where: { userId: id } });
  }

  return NextResponse.json({ user: serializeAdminUser(user) });
}
