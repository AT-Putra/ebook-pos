import {
  isOnSale,
  salesStatus,
  wibDayStart,
  wibDayEnd,
  toWibDateInput,
  parseSalesStart,
  parseSalesEnd,
} from '@/lib/programs';

const D = (iso: string) => new Date(iso);

describe('isOnSale (sales window — invariant #12)', () => {
  const now = D('2026-06-15T12:00:00+07:00');

  it('is true when active with no bounds', () => {
    expect(isOnSale({ isActive: true, salesStartAt: null, salesEndAt: null }, now)).toBe(true);
  });

  it('is false when inactive', () => {
    expect(isOnSale({ isActive: false, salesStartAt: null, salesEndAt: null }, now)).toBe(false);
  });

  it('is false before the start', () => {
    expect(isOnSale({ isActive: true, salesStartAt: D('2026-06-20T00:00:00+07:00'), salesEndAt: null }, now)).toBe(false);
  });

  it('is false after the end', () => {
    expect(isOnSale({ isActive: true, salesStartAt: null, salesEndAt: D('2026-06-10T23:59:59+07:00') }, now)).toBe(false);
  });

  it('is true within the window', () => {
    expect(isOnSale({
      isActive: true,
      salesStartAt: D('2026-06-10T00:00:00+07:00'),
      salesEndAt: D('2026-06-20T23:59:59+07:00'),
    }, now)).toBe(true);
  });

  it('treats the end instant as inclusive', () => {
    const end = D('2026-06-15T23:59:59.999+07:00');
    expect(isOnSale({ isActive: true, salesStartAt: null, salesEndAt: end }, end)).toBe(true);
  });
});

describe('salesStatus', () => {
  const now = D('2026-06-15T12:00:00+07:00');
  it('inactive when not active', () => {
    expect(salesStatus({ isActive: false, salesStartAt: null, salesEndAt: null }, now)).toBe('inactive');
  });
  it('scheduled before start', () => {
    expect(salesStatus({ isActive: true, salesStartAt: D('2026-07-01T00:00:00+07:00'), salesEndAt: null }, now)).toBe('scheduled');
  });
  it('closed after end', () => {
    expect(salesStatus({ isActive: true, salesStartAt: null, salesEndAt: D('2026-06-01T23:59:59+07:00') }, now)).toBe('closed');
  });
  it('open within window', () => {
    expect(salesStatus({ isActive: true, salesStartAt: null, salesEndAt: null }, now)).toBe('open');
  });
});

describe('WIB date helpers', () => {
  it('wibDayStart is 00:00 WIB of the date', () => {
    expect(wibDayStart('2026-06-06').toISOString()).toBe(D('2026-06-06T00:00:00.000+07:00').toISOString());
  });
  it('wibDayEnd is 23:59:59.999 WIB of the date (inclusive)', () => {
    expect(wibDayEnd('2026-06-06').toISOString()).toBe(D('2026-06-06T23:59:59.999+07:00').toISOString());
  });
  it('toWibDateInput maps an instant to its WIB calendar date', () => {
    // 2026-06-05T17:30Z is 2026-06-06T00:30 WIB
    expect(toWibDateInput(D('2026-06-05T17:30:00Z'))).toBe('2026-06-06');
    expect(toWibDateInput(null)).toBe('');
  });
  it('parseSalesStart/End handle empty + value', () => {
    expect(parseSalesStart(undefined)).toBeNull();
    expect(parseSalesEnd('')).toBeNull();
    expect(parseSalesStart('2026-06-06')!.toISOString()).toBe(wibDayStart('2026-06-06').toISOString());
    expect(parseSalesEnd('2026-06-06')!.toISOString()).toBe(wibDayEnd('2026-06-06').toISOString());
  });
});
