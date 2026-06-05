import { db } from './db';
import { env } from './env';

/** Normalize an origin to "scheme://host[:port]" (lowercased host, no trailing slash/path).
 *  Returns null if the input isn't a valid http(s) origin. */
export function normalizeOrigin(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const port = url.port ? `:${url.port}` : '';
  return `${url.protocol}//${url.hostname.toLowerCase()}${port}`;
}

/** The app's own origin is always allowed (the built-in checkout page). */
function appOrigin(): string | null {
  return normalizeOrigin(env.APP_BASE_URL);
}

/** True if `origin` is the app's own origin or an active entry in AllowedOrigin. */
export async function isOriginAllowed(origin: string | null): Promise<boolean> {
  if (!origin) return false;
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;
  if (normalized === appOrigin()) return true;
  const row = await db.allowedOrigin.findUnique({ where: { origin: normalized } });
  return row !== null && row.isActive;
}

/** CORS headers to attach to a /api/checkout response (and its preflight).
 *  Returns {} when the origin is absent or not allowed — the browser then blocks
 *  the cross-origin read. Same-origin/server-side callers (no Origin) are unaffected. */
export async function corsHeadersFor(origin: string | null): Promise<Record<string, string>> {
  if (!origin || !(await isOriginAllowed(origin))) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}
