import { NextRequest } from 'next/server';
import { isAdmin, isCron } from '@/lib/auth';

// jest.setup.ts sets ADMIN_TOKEN='test-admin-token' and CRON_SECRET='test-cron-secret'

function makeReq(headers: Record<string, string> = {}, query = ''): NextRequest {
  return new NextRequest(`http://localhost/test${query}`, { headers });
}

describe('isAdmin', () => {
  it('accepts a valid bearer token', () => {
    expect(isAdmin(makeReq({ authorization: 'Bearer test-admin-token' }))).toBe(true);
  });

  it('rejects a wrong token', () => {
    expect(isAdmin(makeReq({ authorization: 'Bearer wrong-token' }))).toBe(false);
  });

  it('rejects missing header', () => {
    expect(isAdmin(makeReq())).toBe(false);
  });

  it('rejects basic auth (must be Bearer)', () => {
    expect(isAdmin(makeReq({ authorization: 'Basic dGVzdA==' }))).toBe(false);
  });
});

describe('isCron', () => {
  it('accepts a valid x-cron-secret header', () => {
    expect(isCron(makeReq({ 'x-cron-secret': 'test-cron-secret' }))).toBe(true);
  });

  it('rejects the secret in a query string (header-only — no ?secret= in logs)', () => {
    expect(isCron(makeReq({}, '?secret=test-cron-secret'))).toBe(false);
  });

  it('rejects wrong secret', () => {
    expect(isCron(makeReq({ 'x-cron-secret': 'wrong' }))).toBe(false);
  });

  it('rejects missing secret', () => {
    expect(isCron(makeReq())).toBe(false);
  });
});
