import { normalizeIndonesianPhone, toChatId, PhoneNormalizationError, waLinkFromText } from '@/lib/phone';

describe('waLinkFromText (CS contact on thank-you, D16/§21)', () => {
  it('extracts a 08… number from free text', () => {
    expect(waLinkFromText('Hubungi admin di 0812-3456-789')).toBe('https://wa.me/628123456789');
  });
  it('extracts a +62 number', () => {
    expect(waLinkFromText('WA: +62 858 1111 2222')).toBe('https://wa.me/6285811112222');
  });
  it('returns null when there is no phone number', () => {
    expect(waLinkFromText('Email kami di support@toko.com')).toBeNull();
  });
  it('returns null for an empty string', () => {
    expect(waLinkFromText('')).toBeNull();
  });
});

describe('normalizeIndonesianPhone', () => {
  it.each([
    ['08123456789', '628123456789'],
    ['8123456789', '628123456789'],
    ['628123456789', '628123456789'],
    ['+628123456789', '628123456789'],
    ['0812-3456-789', '628123456789'],
    ['0812 3456 789', '628123456789'],
    ['(0812) 3456 789', '628123456789'],
  ])('normalizes "%s" → "%s"', (input, expected) => {
    expect(normalizeIndonesianPhone(input)).toBe(expected);
  });

  it.each([
    '123456789',       // no valid prefix
    '0212345678',      // landline-style (starts 021, not mobile)
    'abc08123456789',  // non-digit characters remain
    '08',              // too short
    '6281234567890123456', // too long
  ])('throws for invalid input "%s"', input => {
    expect(() => normalizeIndonesianPhone(input)).toThrow(PhoneNormalizationError);
  });
});

describe('toChatId', () => {
  it('appends @c.us', () => {
    expect(toChatId('628123456789')).toBe('628123456789@c.us');
  });
});
