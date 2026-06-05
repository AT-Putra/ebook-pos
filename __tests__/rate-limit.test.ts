import { evaluateBucket, clientIpFromHeaders } from '@/lib/rate-limit';

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
