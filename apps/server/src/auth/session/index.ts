import { randomBytes } from 'node:crypto';
import type { FastifyReply } from 'fastify';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { env } from '../../env.js';
import { sessions } from '../../db/schema.js';
import * as schema from '../../db/schema.js';
import { hashToken } from '../../utils/otp.js';

type Db = NodePgDatabase<typeof schema>;

export async function issue(
  db: Db,
  userId: string,
  userAgent: string | undefined,
): Promise<string> {
  const token = randomBytes(32).toString('hex');
  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + env.SESSION_TTL_MS),
    userAgent,
  });
  return token;
}

export function attachCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(env.COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'strict',
    path: '/',
    domain: env.COOKIE_DOMAIN,
    maxAge: Math.floor(env.SESSION_TTL_MS / 1000),
  });
}

export function clearCookie(reply: FastifyReply): void {
  reply.clearCookie(env.COOKIE_NAME, {
    path: '/',
    domain: env.COOKIE_DOMAIN,
  });
}
