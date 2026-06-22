import { buildDateSeries, rate } from '@/lib/report';

describe('buildDateSeries', () => {
  it('returns a single date when from == to (no spurious extra day)', () => {
    expect(buildDateSeries('2026-06-01', '2026-06-01')).toEqual(['2026-06-01']);
  });

  it('returns 14 consecutive WIB dates for a 14-day range', () => {
    const result = buildDateSeries('2026-05-19', '2026-06-01');
    expect(result).toHaveLength(14);
    expect(result[0]).toBe('2026-05-19');
    expect(result[13]).toBe('2026-06-01');
  });

  it('crosses a month boundary correctly', () => {
    const result = buildDateSeries('2026-05-30', '2026-06-02');
    expect(result).toEqual(['2026-05-30', '2026-05-31', '2026-06-01', '2026-06-02']);
  });

  it('returns empty array when from > to', () => {
    expect(buildDateSeries('2026-06-05', '2026-06-01')).toHaveLength(0);
  });
});

describe('rate (convRate / convRateActive)', () => {
  it('returns 0 when the denominator is 0 (no purchases yet)', () => {
    expect(rate(0, 0)).toBe(0);
    expect(rate(5, 0)).toBe(0);
  });

  it('computes Active / purchases at 4-decimal precision', () => {
    expect(rate(38, 100)).toBe(0.38);
    expect(rate(1, 3)).toBe(0.3333);
  });

  it('caps at 1 for a full conversion', () => {
    expect(rate(10, 10)).toBe(1);
  });
});
