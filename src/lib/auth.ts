import { NextRequest } from 'next/server';
import { env } from './env';

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
