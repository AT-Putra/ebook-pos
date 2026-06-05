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
