import { SEED_PRODUCTS } from '../prisma/seedData';

describe('F7 seed data', () => {
  it('has at least one product', () => {
    expect(SEED_PRODUCTS.length).toBeGreaterThan(0);
  });

  it.each(SEED_PRODUCTS)('product "$slug" has all required fields', product => {
    expect(typeof product.slug).toBe('string');
    expect(product.slug.length).toBeGreaterThan(0);
    expect(typeof product.name).toBe('string');
    expect(product.name.length).toBeGreaterThan(0);
    expect(typeof product.priceIdr).toBe('number');
    expect(Number.isInteger(product.priceIdr)).toBe(true);
    expect(product.priceIdr).toBeGreaterThan(0);
    expect(typeof product.filePath).toBe('string');
    expect(product.filePath.length).toBeGreaterThan(0);
    expect(typeof product.fileName).toBe('string');
    expect(product.fileName.length).toBeGreaterThan(0);
    expect(typeof product.mimeType).toBe('string');
    expect(typeof product.isActive).toBe('boolean');
  });

  it('product slugs are URL-safe (lowercase, hyphens, no spaces)', () => {
    for (const p of SEED_PRODUCTS) {
      expect(p.slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('filePath is relative (no leading slash, no absolute path)', () => {
    for (const p of SEED_PRODUCTS) {
      expect(p.filePath.startsWith('/')).toBe(false);
      expect(p.filePath.startsWith('..')).toBe(false);
    }
  });

  it('priceIdr is IDR integer with no decimals', () => {
    for (const p of SEED_PRODUCTS) {
      expect(Number.isInteger(p.priceIdr)).toBe(true);
    }
  });

  it('the v1 product matches expected values', () => {
    const product = SEED_PRODUCTS[0];
    expect(product.slug).toBe('lose-weight-challenge-1st-edition');
    expect(product.priceIdr).toBe(75000);
    expect(product.mimeType).toBe('application/pdf');
    expect(product.isActive).toBe(true);
  });
});
