import crypto from 'crypto';
import { verifyWahaSignature, typingDelayMs } from '@/lib/waha';

const SECRET = 'test-waha-webhook-secret'; // matches jest.setup.ts

function hmac(body: string): string {
  return crypto.createHmac('sha512', SECRET).update(body).digest('hex');
}

describe('verifyWahaSignature (inbound webhook auth, §21.6)', () => {
  const body = JSON.stringify({ event: 'message', payload: { id: 'abc' } });

  it('accepts a correct HMAC-SHA512 of the raw body', () => {
    expect(verifyWahaSignature(body, hmac(body))).toBe(true);
  });

  it('rejects a tampered body', () => {
    expect(verifyWahaSignature(body + ' ', hmac(body))).toBe(false);
  });

  it('rejects a missing header', () => {
    expect(verifyWahaSignature(body, null)).toBe(false);
  });

  it('rejects a garbage signature without throwing', () => {
    expect(verifyWahaSignature(body, 'not-hex')).toBe(false);
  });
});

describe('typingDelayMs (humanized send, §12.2.1)', () => {
  it('scales with length and stays within jittered bounds', () => {
    const short = typingDelayMs('hi', 0.5);
    const long = typingDelayMs('x'.repeat(500), 0.5);
    expect(long).toBeGreaterThan(short);
    // capped at 6000 * (0.7..1.3); with rnd=0.5 multiplier = 1.0 → <= 6000
    expect(typingDelayMs('x'.repeat(10000), 0.5)).toBeLessThanOrEqual(6000);
  });

  it('is deterministic given rnd', () => {
    expect(typingDelayMs('hello', 0)).toBe(typingDelayMs('hello', 0));
  });
});
