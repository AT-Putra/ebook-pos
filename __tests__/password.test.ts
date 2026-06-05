import { hashPassword, verifyPassword } from '@/lib/password';

describe('hashPassword', () => {
  it('produces a scrypt$ prefixed string with salt and hash', async () => {
    const hash = await hashPassword('secret');
    const parts = hash.split('$');
    expect(parts[0]).toBe('scrypt');
    expect(parts[1]).toHaveLength(32); // 16 bytes hex
    expect(parts[2]).toHaveLength(128); // 64 bytes hex
  });

  it('produces different hashes for the same password (random salt)', async () => {
    const a = await hashPassword('same');
    const b = await hashPassword('same');
    expect(a).not.toBe(b);
  });
});

describe('verifyPassword', () => {
  it('returns true for correct password', async () => {
    const hash = await hashPassword('correct');
    expect(await verifyPassword('correct', hash)).toBe(true);
  });

  it('returns false for wrong password', async () => {
    const hash = await hashPassword('correct');
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('returns false for malformed hash', async () => {
    expect(await verifyPassword('any', 'notvalid')).toBe(false);
    expect(await verifyPassword('any', 'wrong$format')).toBe(false);
  });
});
