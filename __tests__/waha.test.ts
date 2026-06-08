import crypto from 'crypto';
import { verifyWahaSignature, typingDelayMs, parseJid, primeDelayMs, checkNumberExists } from '@/lib/waha';

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

describe('primeDelayMs (post-existence-check pause, §12.2.1)', () => {
  it('stays within the 1500–3500ms band', () => {
    expect(primeDelayMs(0)).toBe(1500);
    expect(primeDelayMs(1)).toBe(3500);
    expect(primeDelayMs(0.5)).toBe(2500);
  });
  it('is deterministic given rnd', () => {
    expect(primeDelayMs(0.25)).toBe(primeDelayMs(0.25));
  });
});

describe('checkNumberExists (recipient priming, §12.2.1)', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  it('parses numberExists + chatId from a 200 response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ numberExists: true, chatId: '628123@c.us' }),
    }) as unknown as typeof fetch;
    expect(await checkNumberExists('628123')).toEqual({ numberExists: true, chatId: '628123@c.us' });
  });

  it('returns null when the WAHA call fails (non-ok)', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;
    expect(await checkNumberExists('628123')).toBeNull();
  });
});

describe('parseJid (WhatsApp sender classification, §21.6)', () => {
  it('classifies a phone-number chatId', () => {
    expect(parseJid('628123456789@c.us')).toEqual({ kind: 'phone', id: '628123456789' });
  });
  it('classifies a privacy LID', () => {
    expect(parseJid('31095596777502@lid')).toEqual({ kind: 'lid', id: '31095596777502' });
  });
  it('treats group / unknown jids as other', () => {
    expect(parseJid('123-456@g.us').kind).toBe('other');
  });
});
