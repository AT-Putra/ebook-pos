import { normalizeEngineName, isFonnteConfigured, isFonnteWebhookConfigured, DEFAULT_ENGINE } from '@/lib/messaging';

describe('normalizeEngineName (engine resolution, §24.1)', () => {
  it('keeps a known engine', () => {
    expect(normalizeEngineName('fonnte')).toBe('fonnte');
    expect(normalizeEngineName('waha')).toBe('waha');
  });
  it('defaults unknown/blank/null to WAHA', () => {
    expect(normalizeEngineName(null)).toBe('waha');
    expect(normalizeEngineName(undefined)).toBe('waha');
    expect(normalizeEngineName('')).toBe('waha');
    expect(normalizeEngineName('garbage')).toBe('waha');
  });
  it('defaults to WAHA', () => {
    expect(DEFAULT_ENGINE).toBe('waha');
  });
});

describe('Fonnte env presence (settings warnings, §24.5)', () => {
  it('reports configured when env is set (jest.setup provides both)', () => {
    expect(isFonnteConfigured()).toBe(true);
    expect(isFonnteWebhookConfigured()).toBe(true);
  });
});
