import { z } from 'zod';

const envSchema = z.object({
  APP_BASE_URL: z.string().url(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  MIDTRANS_SERVER_KEY: z.string().min(1),
  MIDTRANS_CLIENT_KEY: z.string().min(1),
  MIDTRANS_IS_PRODUCTION: z
    .string()
    .optional()
    .default('false')
    .transform(v => v === 'true'),
  WAHA_BASE_URL: z.string().startsWith('https://', {
    message: 'WAHA_BASE_URL must start with https:// (never plain http)',
  }),
  WAHA_API_KEY: z.string().min(1),
  WAHA_SESSION: z.string().default('default'),
  WAHA_WEBHOOK_SECRET: z.string().optional().default(''), // HMAC key for /api/webhooks/waha (§21.6)
  EBOOK_FILES_DIR: z.string().min(1),
  CHALLENGE_MEDIA_DIR: z.string().optional().default('/data/challenge-media'), // private proof videos (§21)
  ADMIN_TOKEN: z.string().min(1),
  CRON_SECRET: z.string().min(1),
  // Email fallback (D14, §23) — all optional; the fallback is OFF unless enabled + creds set.
  EMAIL_FALLBACK_ENABLED: z
    .string()
    .optional()
    .default('false')
    .transform(v => v === 'true' || v === '1'),
  GMAIL_USER: z.string().optional().default(''),
  GMAIL_APP_PASSWORD: z.string().optional().default(''),
  EMAIL_FROM: z.string().optional().default(''),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(raw: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const msg = result.error.issues
      .map(i => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${msg}`);
  }
  return result.data;
}

// Lazy singleton — validates on first property access (not at module load time).
// This lets Next.js import the module during build without needing env vars set,
// while still failing fast on the first real request if a variable is missing.
let _cached: Env | undefined;

function getEnv(): Env {
  if (!_cached) _cached = parseEnv(process.env);
  return _cached;
}

export const env: Env = new Proxy({} as Env, {
  get(_, prop: PropertyKey): unknown {
    return getEnv()[prop as keyof Env];
  },
});
