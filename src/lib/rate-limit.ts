import { db } from './db';

export type RateLimitConfig = {
  enabled: boolean;
  maxRequests: number;
  windowSeconds: number;
};

export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  enabled: true,
  maxRequests: 10,
  windowSeconds: 60,
};

// ── Config (cached read; cleared on update) ──────────────────────────────
let cache: { value: RateLimitConfig; at: number } | null = null;
const CONFIG_TTL_MS = 10_000;

export function clearRateLimitConfigCache() {
  cache = null;
}

export async function getRateLimitConfig(): Promise<RateLimitConfig> {
  if (cache && Date.now() - cache.at < CONFIG_TTL_MS) return cache.value;
  const row = await db.rateLimitConfig.findUnique({ where: { id: 'default' } });
  const value: RateLimitConfig = row
    ? { enabled: row.enabled, maxRequests: row.maxRequests, windowSeconds: row.windowSeconds }
    : DEFAULT_RATE_LIMIT;
  cache = { value, at: Date.now() };
  return value;
}

// ── Pure fixed-window evaluation (unit-tested) ───────────────────────────
export type Bucket = { count: number; resetAt: number };

export function evaluateBucket(
  bucket: Bucket | undefined,
  now: number,
  windowMs: number,
  maxRequests: number,
): { bucket: Bucket; allowed: boolean; retryAfter: number } {
  if (!bucket || bucket.resetAt <= now) {
    return { bucket: { count: 1, resetAt: now + windowMs }, allowed: true, retryAfter: 0 };
  }
  if (bucket.count >= maxRequests) {
    return { bucket, allowed: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return {
    bucket: { count: bucket.count + 1, resetAt: bucket.resetAt },
    allowed: true,
    retryAfter: 0,
  };
}

/** Extracts the client IP from proxy headers (Caddy sets X-Forwarded-For). */
export function clientIpFromHeaders(headers: Headers): string {
  const xff = headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return headers.get('x-real-ip') ?? 'unknown';
}

// ── In-memory per-IP store (single container; resets on restart) ──────────
const buckets = new Map<string, Bucket>();
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}

export type RateLimitResult = { allowed: boolean; retryAfter: number };

export async function checkRateLimit(ip: string): Promise<RateLimitResult> {
  const cfg = await getRateLimitConfig();
  if (!cfg.enabled) return { allowed: true, retryAfter: 0 };

  const now = Date.now();
  sweep(now);
  const result = evaluateBucket(buckets.get(ip), now, cfg.windowSeconds * 1000, cfg.maxRequests);
  buckets.set(ip, result.bucket);
  return { allowed: result.allowed, retryAfter: result.retryAfter };
}

// ── Admin-login brute-force limiter (fixed, NOT admin-configurable) ───────────
// A separate, always-on per-IP limiter for /api/admin/auth/login — independent of the
// checkout RateLimitConfig (which an admin can disable). Keyed by IP only (no per-username
// bucket) so an attacker can never lock a legitimate admin out by spamming their username.
export const LOGIN_MAX_ATTEMPTS = 8;
export const LOGIN_WINDOW_MS = 5 * 60_000; // 5 minutes
const loginBuckets = new Map<string, Bucket>();
let lastLoginSweep = 0;

/** Per-IP fixed-window throttle for the admin login endpoint. Synchronous (no DB).
 *  `now` is injectable for tests. */
export function checkLoginRateLimit(ip: string, now: number = Date.now()): RateLimitResult {
  if (now - lastLoginSweep >= 60_000) {
    lastLoginSweep = now;
    for (const [k, b] of loginBuckets) if (b.resetAt <= now) loginBuckets.delete(k);
  }
  const result = evaluateBucket(loginBuckets.get(ip), now, LOGIN_WINDOW_MS, LOGIN_MAX_ATTEMPTS);
  loginBuckets.set(ip, result.bucket);
  return { allowed: result.allowed, retryAfter: result.retryAfter };
}

// ── E-book download phone-gate limiter (D16, §25) ────────────────────────────
// Throttles wrong-number attempts on /api/download/[token] so a leaked link can't be used to
// enumerate phone numbers. Keyed by `token + IP` (passed in by the caller).
export const DOWNLOAD_MAX_ATTEMPTS = 5;
export const DOWNLOAD_WINDOW_MS = 5 * 60_000; // 5 minutes
const downloadBuckets = new Map<string, Bucket>();
let lastDownloadSweep = 0;

/** Per-(token+IP) fixed-window throttle for the download phone gate. Synchronous; `now` injectable. */
export function checkDownloadRateLimit(key: string, now: number = Date.now()): RateLimitResult {
  if (now - lastDownloadSweep >= 60_000) {
    lastDownloadSweep = now;
    for (const [k, b] of downloadBuckets) if (b.resetAt <= now) downloadBuckets.delete(k);
  }
  const result = evaluateBucket(downloadBuckets.get(key), now, DOWNLOAD_WINDOW_MS, DOWNLOAD_MAX_ATTEMPTS);
  downloadBuckets.set(key, result.bucket);
  return { allowed: result.allowed, retryAfter: result.retryAfter };
}
