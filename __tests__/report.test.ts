import { buildDateSeries, rate, activeForDay, type ActiveWindow } from '@/lib/report';

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

describe('activeForDay (per-day Active reconstruction)', () => {
  const windows: ActiveWindow[] = [
    { startDay: '2026-06-01', endDay: null },          // still running
    { startDay: '2026-06-05', endDay: '2026-06-10' },  // ran, then stopped
    { startDay: '2026-06-12', endDay: '2026-06-12' },  // started & stopped same day
  ];
  const paidDays = ['2026-05-30', '2026-06-04', '2026-06-11'];

  it('counts only windows whose RUNNING span covers the day', () => {
    // 2026-06-06: first (ongoing) + second (05–10) active; third not started.
    expect(activeForDay(windows, paidDays, '2026-06-06').active).toBe(2);
  });

  it('includes both window endpoints (inclusive bounds)', () => {
    expect(activeForDay(windows, paidDays, '2026-06-10').active).toBe(2); // end of #2
    expect(activeForDay(windows, paidDays, '2026-06-12').active).toBe(2); // #1 ongoing + #3 same-day
  });

  it('excludes a day before anyone started', () => {
    expect(activeForDay(windows, paidDays, '2026-05-31').active).toBe(0);
  });

  it('keeps an ongoing (null endDay) window active on every day from its start', () => {
    expect(activeForDay(windows, paidDays, '2026-06-20').active).toBe(1); // only #1 still ongoing
  });

  it('divides active by cumulative purchases as of that day', () => {
    // day 06-06: active 2, purchases paid on/before = 05-30 + 06-04 = 2 → 1.0
    expect(activeForDay(windows, paidDays, '2026-06-06').convRateActive).toBe(1);
    // day 06-20: active 1, purchases = all 3 → 0.3333
    expect(activeForDay(windows, paidDays, '2026-06-20').convRateActive).toBe(0.3333);
  });
});
