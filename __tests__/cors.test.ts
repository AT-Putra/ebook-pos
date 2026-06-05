import { normalizeOrigin } from '@/lib/cors';

describe('normalizeOrigin', () => {
  it('keeps a clean https origin', () => {
    expect(normalizeOrigin('https://landing.contoh.com')).toBe('https://landing.contoh.com');
  });

  it('strips path, query, and trailing slash', () => {
    expect(normalizeOrigin('https://landing.contoh.com/checkout?a=1')).toBe('https://landing.contoh.com');
  });

  it('lowercases the host but preserves the port', () => {
    expect(normalizeOrigin('http://LocalHost:3001')).toBe('http://localhost:3001');
  });

  it('rejects non-http(s) protocols', () => {
    expect(normalizeOrigin('ftp://x.com')).toBeNull();
    expect(normalizeOrigin('javascript:alert(1)')).toBeNull();
  });

  it('rejects garbage', () => {
    expect(normalizeOrigin('not a url')).toBeNull();
    expect(normalizeOrigin('')).toBeNull();
  });
});
