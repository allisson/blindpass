import 'dotenv/config';
import { z } from 'zod';

const schema = z
  .object({
    DATABASE_URL: z.url(),
    PORT: z.coerce.number().default(3000),
    LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
    BODY_LIMIT_BYTES: z.coerce.number().default(524288),
    DB_POOL_MAX: z.coerce.number().default(10),
    REDIS_URL: z.url().optional(),
    PENDING_TOTP_TTL_MS: z.coerce.number().default(15 * 60 * 1000),
    RECOVERY_TOKEN_TTL_MS: z.coerce.number().default(15 * 60 * 1000),
    UNVERIFIED_ACCOUNT_TTL_MS: z.coerce.number().default(24 * 60 * 60 * 1000),
    TOTP_SECRET_ENCRYPTION_KEY: z.string().min(44),
    SESSION_TTL_MS: z.coerce.number().default(14 * 24 * 60 * 60 * 1000),
    SESSION_IDLE_TTL_MS: z.coerce.number().default(7 * 24 * 60 * 60 * 1000),
    CORS_ORIGIN: z
      .string()
      .default('http://localhost:5173')
      .transform((v) => v.split(',').map((s) => s.trim()))
      .pipe(z.array(z.url())),
    COOKIE_NAME: z.string().min(1).default('bp_session'),
    COOKIE_DOMAIN: z.string().min(1).optional(),
    COOKIE_SECURE: z
      .enum(['true', 'false'])
      .default('true')
      .transform((v) => v === 'true'),
    NODE_ENV: z.enum(['development', 'production', 'test']),
    EXPOSE_DOCS: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production' && !data.REDIS_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['REDIS_URL'],
        message: 'REDIS_URL is required in production',
      });
    }
    if (data.NODE_ENV === 'production' && !data.COOKIE_SECURE) {
      ctx.addIssue({
        code: 'custom',
        path: ['COOKIE_SECURE'],
        message: 'COOKIE_SECURE must be true in production',
      });
    }
    if (data.SESSION_IDLE_TTL_MS > data.SESSION_TTL_MS) {
      ctx.addIssue({
        code: 'custom',
        path: ['SESSION_IDLE_TTL_MS'],
        message: 'SESSION_IDLE_TTL_MS must not exceed SESSION_TTL_MS',
      });
    }
  });

export const env = schema.parse(process.env);
