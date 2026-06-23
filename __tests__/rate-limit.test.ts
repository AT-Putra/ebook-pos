import { evaluateBucket, clientIpFromHeaders, checkLoginRateLimit, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS, checkDownloadRateLimit, DOWNLOAD_MAX_ATTEMPTS, DOWNLOAD_WINDOW_MS } from '@/lib/rate-limit';

describe('evaluateBucket (fixed window)', () => {
  const WINDOW = 60_000;
  const MAX = 3;

  it('allows the first request and opens a window', () => {
    const r = evaluateBucket(undefined, 1000, WINDOW, MAX);
    expect(r.allowed).toBe(true);
    expect(r.bucket).toEqual({ count: 1, resetAt: 1000 + WINDOW });
  });

  it('increments within the window while under the limit', () => {
    const r = evaluateBucket({ count: 1, resetAt: 61_000 }, 2000, WINDOW, MAX);
    expect(r.allowed).toBe(true);
    expect(r.bucket.count).toBe(2);
  });

  it('blocks once the limit is reached and reports retryAfter', () => {
    const r = evaluateBucket({ count: 3, resetAt: 61_000 }, 2000, WINDOW, MAX);
    expect(r.allowed).toBe(false);
    expect(r.retryAfter).toBe(59); // ceil((61000-2000)/1000)
  });

  it('resets after the window expires', () => {
    const r = evaluateBucket({ count: 3, resetAt: 1000 }, 2000, WINDOW, MAX);
    expect(r.allowed).toBe(true);
    expect(r.bucket).toEqual({ count: 1, resetAt: 2000 + WINDOW });
  });
});

describe('checkLoginRateLimit (admin login brute-force throttle)', () => {
  it('allows up to LOGIN_MAX_ATTEMPTS then blocks within the window', () => {
    const ip = '203.0.113.99'; // unique IP — module state is per-key
    const t0 = 1_000_000;
    for (let i = 0; i < LOGIN_MAX_ATTEMPTS; i++) {
      expect(checkLoginRateLimit(ip, t0).allowed).toBe(true);
    }
    const blocked = checkLoginRateLimit(ip, t0);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it('resets after the window elapses', () => {
    const ip = '203.0.113.100';
    const t0 = 2_000_000;
    for (let i = 0; i < LOGIN_MAX_ATTEMPTS; i++) checkLoginRateLimit(ip, t0);
    expect(checkLoginRateLimit(ip, t0).allowed).toBe(false);
    // After the window, the bucket reopens.
    expect(checkLoginRateLimit(ip, t0 + LOGIN_WINDOW_MS + 1).allowed).toBe(true);
  });

  it('tracks each IP independently', () => {
    const t0 = 3_000_000;
    for (let i = 0; i < LOGIN_MAX_ATTEMPTS; i++) checkLoginRateLimit('203.0.113.101', t0);
    expect(checkLoginRateLimit('203.0.113.101', t0).allowed).toBe(false);
    expect(checkLoginRateLimit('203.0.113.102', t0).allowed).toBe(true); // different IP unaffected
  });
});

describe('checkDownloadRateLimit (e-book download phone-gate throttle, §25)', () => {
  it('allows up to DOWNLOAD_MAX_ATTEMPTS per (token+IP) then blocks', () => {
    const key = 'tok-aaa:203.0.113.50';
    const t0 = 5_000_000;
    for (let i = 0; i < DOWNLOAD_MAX_ATTEMPTS; i++) {
      expect(checkDownloadRateLimit(key, t0).allowed).toBe(true);
    }
    expect(checkDownloadRateLimit(key, t0).allowed).toBe(false);
  });

  it('reopens after the window', () => {
    const key = 'tok-bbb:203.0.113.51';
    const t0 = 6_000_000;
    for (let i = 0; i < DOWNLOAD_MAX_ATTEMPTS; i++) checkDownloadRateLimit(key, t0);
    expect(checkDownloadRateLimit(key, t0).allowed).toBe(false);
    expect(checkDownloadRateLimit(key, t0 + DOWNLOAD_WINDOW_MS + 1).allowed).toBe(true);
  });

  it('tracks each token+IP key independently', () => {
    const t0 = 7_000_000;
    for (let i = 0; i < DOWNLOAD_MAX_ATTEMPTS; i++) checkDownloadRateLimit('tok-ccc:1.1.1.1', t0);
    expect(checkDownloadRateLimit('tok-ccc:1.1.1.1', t0).allowed).toBe(false);
    expect(checkDownloadRateLimit('tok-ccc:2.2.2.2', t0).allowed).toBe(true); // different IP
    expect(checkDownloadRateLimit('tok-ddd:1.1.1.1', t0).allowed).toBe(true); // different token
  });
});

describe('clientIpFromHeaders', () => {
  it('takes the first IP from X-Forwarded-For', () => {
    const h = new Headers({ 'x-forwarded-for': '203.0.113.5, 10.0.0.1' });
    expect(clientIpFromHeaders(h)).toBe('203.0.113.5');
  });

  it('falls back to x-real-ip then "unknown"', () => {
    expect(clientIpFromHeaders(new Headers({ 'x-real-ip': '198.51.100.2' }))).toBe('198.51.100.2');
    expect(clientIpFromHeaders(new Headers())).toBe('unknown');
  });
});
