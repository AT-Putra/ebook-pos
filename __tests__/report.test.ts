import { buildDateSeries, rate, bucketActiveByDay } from '@/lib/report';

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

describe('bucketActiveByDay (per-day Active event count)', () => {
  it('counts each participant only on the WIB day they became active (startAt)', () => {
    const counts = bucketActiveByDay([
      '2026-06-01', '2026-06-01', '2026-06-03',
    ]);
    expect(counts.get('2026-06-01')).toBe(2);
    expect(counts.get('2026-06-03')).toBe(1);
  });

  it('does not spread a participant across the days they stay RUNNING', () => {
    // Only the start day is recorded — a day with no new active has no entry (→ 0 in the table).
    const counts = bucketActiveByDay(['2026-06-05']);
    expect(counts.get('2026-06-05')).toBe(1);
    expect(counts.get('2026-06-06')).toBeUndefined();
  });

  it('returns an empty map when no participant has started', () => {
    expect(bucketActiveByDay([]).size).toBe(0);
  });
});
