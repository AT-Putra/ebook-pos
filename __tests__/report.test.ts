import { buildDateSeries } from '@/lib/report';

describe('buildDateSeries', () => {
  it('returns a single date when from == to', () => {
    const from = new Date('2026-06-01T00:00:00+07:00');
    const to = new Date('2026-06-01T23:59:59+07:00');
    const result = buildDateSeries(from, to);
    expect(result).toEqual(['2026-06-01']);
  });

  it('returns 14 dates for a 14-day range', () => {
    const from = new Date('2026-05-19T00:00:00+07:00');
    const to = new Date('2026-06-01T00:00:00+07:00');
    const result = buildDateSeries(from, to);
    expect(result).toHaveLength(14);
    expect(result[0]).toBe('2026-05-19');
    expect(result[13]).toBe('2026-06-01');
  });

  it('returns empty array when from > to', () => {
    const from = new Date('2026-06-05T00:00:00+07:00');
    const to = new Date('2026-06-01T00:00:00+07:00');
    const result = buildDateSeries(from, to);
    expect(result).toHaveLength(0);
  });
});
