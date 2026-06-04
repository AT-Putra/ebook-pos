// Set all required env vars before any module is imported so env.ts doesn't throw.
// NODE_ENV is already 'test' when Jest runs — do not reassign (it's read-only in strict TS).
process.env.APP_BASE_URL = 'https://test.example.com';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.MIDTRANS_SERVER_KEY = 'SB-Mid-server-test';
process.env.MIDTRANS_CLIENT_KEY = 'SB-Mid-client-test';
process.env.MIDTRANS_IS_PRODUCTION = 'false';
process.env.WAHA_BASE_URL = 'https://waha.test.example.com';
process.env.WAHA_API_KEY = 'test-waha-api-key';
process.env.WAHA_SESSION = 'default';
process.env.EBOOK_FILES_DIR = '/tmp/test-ebooks';
process.env.ADMIN_TOKEN = 'test-admin-token';
process.env.CRON_SECRET = 'test-cron-secret';
