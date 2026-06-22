import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import type { AdminUser } from '@prisma/client';
import { env } from './env';
import { validateSession, COOKIE_NAME } from './session';

/** Returns true if the request carries a valid admin bearer token. */
export function isAdmin(req: NextRequest): boolean {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return token === env.ADMIN_TOKEN;
}

/** Returns true if the request carries the cron secret. */
export function isCron(req: NextRequest): boolean {
  const header = req.headers.get('x-cron-secret');
  const query = req.nextUrl.searchParams.get('secret');
  return (header ?? query) === env.CRON_SECRET;
}

/**
 * Authorize an /api/admin/* request by EITHER a valid dashboard session cookie
 * OR the ADMIN_TOKEN bearer (machine/operator/curl callers). Async because the
 * session path hits the DB. Use this in every /api/admin/* route handler — the
 * proxy only guards the /admin/* UI pages, so API routes self-authenticate.
 */
export async function requireAdmin(req: NextRequest): Promise<boolean> {
  if (isAdmin(req)) return true;
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return false;
  return (await validateSession(token)) !== null;
}

/**
 * Resolve the AdminUser behind the request's session cookie, or null. Used by
 * user-management guards (e.g. you can't deactivate yourself). Bearer/machine
 * callers (ADMIN_TOKEN) have no associated user → null, and are not self-guarded.
 */
export async function currentAdminUser(_req: NextRequest): Promise<AdminUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return validateSession(token);
}
