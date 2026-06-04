import { parseEnv } from '@/lib/env';

const validEnv: NodeJS.ProcessEnv = {
  APP_BASE_URL: 'https://example.com',
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/ebook',
  MIDTRANS_SERVER_KEY: 'SB-Mid-server-xxx',
  MIDTRANS_CLIENT_KEY: 'SB-Mid-client-xxx',
  MIDTRANS_IS_PRODUCTION: 'false',
  WAHA_BASE_URL: 'https://waha.example.com',
  WAHA_API_KEY: 'secret-key',
  WAHA_SESSION: 'default',
  EBOOK_FILES_DIR: '/data/ebooks',
  ADMIN_TOKEN: 'admin-secret',
  CRON_SECRET: 'cron-secret',
};

describe('parseEnv', () => {
  it('accepts a fully-valid environment', () => {
    const result = parseEnv(validEnv);
    expect(result.APP_BASE_URL).toBe('https://example.com');
    expect(result.MIDTRANS_IS_PRODUCTION).toBe(false);
    expect(result.WAHA_SESSION).toBe('default');
  });

  it('throws when a required variable is missing', () => {
    const { MIDTRANS_SERVER_KEY: _removed, ...rest } = validEnv;
    expect(() => parseEnv(rest)).toThrow('Invalid environment variables');
  });

  it('rejects WAHA_BASE_URL that is not https://', () => {
    expect(() =>
      parseEnv({ ...validEnv, WAHA_BASE_URL: 'http://waha.example.com' }),
    ).toThrow('https://');
  });

  it('uses "default" for WAHA_SESSION when absent', () => {
    const { WAHA_SESSION: _removed, ...rest } = validEnv;
    const result = parseEnv(rest);
    expect(result.WAHA_SESSION).toBe('default');
  });

  it('coerces MIDTRANS_IS_PRODUCTION string to boolean', () => {
    expect(parseEnv({ ...validEnv, MIDTRANS_IS_PRODUCTION: 'true' }).MIDTRANS_IS_PRODUCTION).toBe(true);
    expect(parseEnv({ ...validEnv, MIDTRANS_IS_PRODUCTION: 'false' }).MIDTRANS_IS_PRODUCTION).toBe(false);
  });
});
