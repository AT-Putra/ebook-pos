import { formatIdr, leadStatusMeta, LEAD_STATUS } from '@/lib/leads';

describe('formatIdr', () => {
  it('formats integer IDR with thousands separators', () => {
    expect(formatIdr(100000)).toBe('Rp 100.000');
    expect(formatIdr(0)).toBe('Rp 0');
    expect(formatIdr(1500000)).toBe('Rp 1.500.000');
  });

  it('rounds (no decimals — invariant #8)', () => {
    expect(formatIdr(99999.6)).toBe('Rp 100.000');
  });
});

describe('leadStatusMeta', () => {
  it('maps every known order status to a label', () => {
    for (const status of Object.keys(LEAD_STATUS)) {
      expect(leadStatusMeta(status).label.length).toBeGreaterThan(0);
    }
    expect(leadStatusMeta('PAID').label).toBe('Lunas');
  });

  it('falls back to the raw value for an unknown status', () => {
    expect(leadStatusMeta('WEIRD').label).toBe('WEIRD');
  });
});
