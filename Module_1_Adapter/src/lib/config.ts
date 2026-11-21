import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development','test','production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  DATABASE_URL: z.string().min(10), REDIS_URL: z.string().min(8),
  PUBLIC_ORIGIN: z.string().url(), ADMIN_ORIGIN: z.string().url(), APP_PUBLIC_URL: z.string().url(),
  TRUST_PROXY: z.coerce.number().int().min(0).max(3).default(0),
  MFA_ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/),
  LOG_HMAC_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/),
  YOUTUBE_API_KEY: z.string().optional().default(''),
  YOUTUBE_SYNC_ENABLED: z.enum(['true','false']).default('false'),
  // PCI_UPDATE_1: run the scheduler inside the API process when no separate worker is deployed.
  RUN_WORKER_IN_API: z.enum(['true','false']).default('false'),
  YOUTUBE_DAILY_SOFT_LIMIT: z.coerce.number().int().min(202).max(10000).default(8000),
  SYNC_VIDEOS_PER_CHANNEL: z.coerce.number().int().min(1).max(50).default(50),
  PUBLIC_CACHE_TTL_SECONDS: z.coerce.number().int().min(10).max(3600).default(300),
  TURNSTILE_SECRET_KEY: z.string().optional().default(''),
  TURNSTILE_EXPECTED_HOSTNAME: z.string().optional().default(''),
  DEV_BYPASS_TURNSTILE: z.enum(['true','false']).default('false'),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().optional().default(''), SMTP_PASS: z.string().optional().default(''),
  SMTP_FROM: z.string().optional().default(''),
  WALL_MESSAGE_RETENTION_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  ADMIN_SESSION_HOURS: z.coerce.number().int().min(1).max(24).default(8),
  ADMIN_IDLE_MINUTES: z.coerce.number().int().min(5).max(480).default(30),
  WALL_SESSION_DAYS: z.coerce.number().int().min(1).max(30).default(7)
});
const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) { console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors); process.exit(1); }
export const config = parsed.data;
if (config.NODE_ENV === 'production') {
  if (config.DEV_BYPASS_TURNSTILE === 'true') throw new Error('Turnstile bypass is forbidden in production');
  if (!config.TURNSTILE_SECRET_KEY || !config.TURNSTILE_EXPECTED_HOSTNAME) throw new Error('Turnstile keys/hostname required in production');
  if (!config.SMTP_HOST || !config.SMTP_FROM) throw new Error('SMTP is required for registered user email verification in production');
  if (!config.PUBLIC_ORIGIN.startsWith('https://') || !config.ADMIN_ORIGIN.startsWith('https://') || !config.APP_PUBLIC_URL.startsWith('https://')) throw new Error('HTTPS origins required in production');
  if (config.YOUTUBE_SYNC_ENABLED === 'true' && !config.YOUTUBE_API_KEY) throw new Error('YOUTUBE_API_KEY missing');
}
