import { randomBytes } from 'node:crypto';
import type { FastifyReply } from 'fastify';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { env } from '../../env.js';
import { sessions } from '../../db/schema.js';
import * as schema from '../../db/schema.js';
import { hashToken } from '../../utils/otp.js';

type Db = NodePgDatabase<typeof schema>;

// Branded opaque type. Constructed only by `issue()`; consumed only by
// `attachCookie()`. The brand prevents callers from synthesising a proof from a
// raw string, and toJSON() guards against accidental serialisation into a
// response body (which would leak the session token to the client payload).
declare const ProofTag: unique symbol;
export type ProofOfSession = {
  readonly token: string;
  readonly [ProofTag]: true;
};

export async function issue(
  db: Db,
  userId: string,
  userAgent: string | undefined,
): Promise<ProofOfSession> {
  const token = randomBytes(32).toString('hex');
  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + env.SESSION_TTL_MS),
    userAgent,
  });
  return makeProof(token);
}

export function attachCookie(reply: FastifyReply, proof: ProofOfSession): void {
  reply.setCookie(env.COOKIE_NAME, proof.token, {
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

function makeProof(token: string): ProofOfSession {
  // Defence in depth against accidental token leakage:
  //   - `token` is non-enumerable so `{ ...proof }`, `Object.keys`, and
  //     `Object.assign({}, proof)` produce empty objects.
  //   - `toJSON` returning undefined drops the field from `JSON.stringify`
  //     (covers Fastify's `reply.send({ proof })` and Pino's log serialiser).
  //   - Both are non-writable / non-configurable (defineProperty defaults), so
  //     callers can't override them.
  // Caveat: util.inspect / console.log read internal slots and will still
  // print the token. Never log a `ProofOfSession`.
  const proof: Record<PropertyKey, unknown> = {};
  Object.defineProperty(proof, 'token', { value: token, enumerable: false });
  Object.defineProperty(proof, 'toJSON', { value: () => undefined, enumerable: false });
  return proof as ProofOfSession;
}
