import { checkoutSchema } from '@/lib/validation';

const validInput = {
  productSlug: 'lose-weight-challenge-1st-edition',
  name: 'Budi Santoso',
  email: 'budi@example.com',
  whatsapp: '08123456789',
};

describe('checkoutSchema', () => {
  it('accepts valid input and normalizes whatsapp', () => {
    const result = checkoutSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.whatsapp).toBe('628123456789');
      expect(result.data.trackingId).toBeUndefined();
    }
  });

  it('captures optional trackingId', () => {
    const result = checkoutSchema.safeParse({ ...validInput, trackingId: 'aff-123' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.trackingId).toBe('aff-123');
  });

  it('rejects missing name', () => {
    const { name: _r, ...rest } = validInput;
    const result = checkoutSchema.safeParse(rest);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(i => i.path[0] === 'name')).toBe(true);
    }
  });

  it('rejects invalid email', () => {
    const result = checkoutSchema.safeParse({ ...validInput, email: 'not-an-email' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(i => i.path[0] === 'email')).toBe(true);
    }
  });

  it('rejects invalid whatsapp number', () => {
    const result = checkoutSchema.safeParse({ ...validInput, whatsapp: '123' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(i => i.path[0] === 'whatsapp')).toBe(true);
    }
  });

  it('normalizes various Indonesian number formats', () => {
    const formats = ['08123456789', '8123456789', '628123456789', '+628123456789'];
    for (const whatsapp of formats) {
      const result = checkoutSchema.safeParse({ ...validInput, whatsapp });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.whatsapp).toBe('628123456789');
    }
  });
});
