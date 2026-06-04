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
  EBOOK_FILES_DIR: z.string().min(1),
  ADMIN_TOKEN: z.string().min(1),
  CRON_SECRET: z.string().min(1),
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

// Singleton — throws at import time if any required variable is missing or invalid.
export const env = parseEnv(process.env);
