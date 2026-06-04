import { normalizeIndonesianPhone, toChatId, PhoneNormalizationError } from '@/lib/phone';

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
