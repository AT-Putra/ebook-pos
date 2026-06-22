import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { verifyPassword } from '@/lib/password';
import { createSession, COOKIE_NAME } from '@/lib/session';
import { checkLoginRateLimit, clientIpFromHeaders } from '@/lib/rate-limit';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const SESSION_DAYS = 7;

export async function POST(req: NextRequest) {
  // Brute-force throttle (per IP, always on) — runs before the expensive scrypt verify.
  const rl = checkLoginRateLimit(clientIpFromHeaders(req.headers));
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Terlalu banyak percobaan login. Silakan coba lagi nanti.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Username dan password diperlukan.' }, { status: 400 });
  }

  const { username, password } = parsed.data;

  const user = await db.adminUser.findUnique({ where: { username } });

  // Constant-time path: always verify even if user not found, to avoid timing attacks.
  const dummyHash = 'scrypt$0000000000000000000000000000000$' + '0'.repeat(128);
  const valid = user
    ? await verifyPassword(password, user.passwordHash)
    : await verifyPassword(password, dummyHash).then(() => false);

  if (!valid || !user?.isActive) {
    return NextResponse.json({ error: 'Username atau password salah.' }, { status: 401 });
  }

  const token = await createSession(user.id);
  await db.adminUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    path: '/',
  });
  return res;
}
