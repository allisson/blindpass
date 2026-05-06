import fp from 'fastify-plugin';
import { createHash } from 'node:crypto';
import { and, eq, gt, isNull, placeholder, sql } from 'drizzle-orm';
import { sessions, users } from '../db/schema.js';
import { env } from '../env.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const authPlugin = fp(async (app) => {
  const PUBLIC_ROUTES = new Set([
    '/auth/register',
    '/auth/register/complete',
    '/auth/login/start',
    '/auth/login/complete',
    '/auth/recovery/start',
    '/auth/recovery/verify',
    '/auth/recovery/complete',
    '/health',
  ]);

  const sessionLookup = app.db
    .select({ id: sessions.id, userId: sessions.userId })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.tokenHash, placeholder('tokenHash')),
        gt(sessions.expiresAt, placeholder('expiresAt')),
        gt(sessions.lastUsedAt, placeholder('idleSince')),
        isNull(users.revokedAt),
      ),
    )
    .limit(1)
    .prepare('auth_session_lookup');

  const sessionTouch = app.db
    .update(sessions)
    .set({ lastUsedAt: sql`NOW()` })
    .where(eq(sessions.id, placeholder('id')))
    .prepare('auth_session_touch');

  app.addHook('onRequest', async (request, reply) => {
    if (PUBLIC_ROUTES.has(request.routeOptions.url ?? '')) return;

    const cookieToken = request.cookies?.[env.COOKIE_NAME];
    const header = request.headers.authorization;
    let token: string | undefined;
    let viaCookie = false;
    if (cookieToken) {
      token = cookieToken;
      viaCookie = true;
    } else if (header?.startsWith('Bearer ')) {
      token = header.slice(7);
    }

    if (!token) {
      request.log.warn(
        { event: 'auth_failed', reason: 'missing_credential', url: request.url, ip: request.ip },
        'Authentication failed',
      );
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    if (viaCookie && !SAFE_METHODS.has(request.method)) {
      const csrfHeader = request.headers['x-bp-client'];
      if (csrfHeader !== 'web') {
        request.log.warn(
          { event: 'auth_failed', reason: 'missing_csrf_header', url: request.url, ip: request.ip },
          'Authentication failed',
        );
        return reply.status(403).send({ error: 'Forbidden' });
      }

      // Defense-in-depth alongside SameSite=Strict and the x-bp-client header:
      // require Origin (or Referer when Origin is absent) to be one of the
      // configured CORS origins. A cross-origin attacker page cannot forge
      // these headers from inside the browser.
      const origin =
        typeof request.headers.origin === 'string' ? request.headers.origin : undefined;
      const referer =
        typeof request.headers.referer === 'string' ? request.headers.referer : undefined;
      let requestOrigin: string | undefined = origin;
      if (!requestOrigin && referer) {
        try {
          requestOrigin = new URL(referer).origin;
        } catch {
          requestOrigin = undefined;
        }
      }
      if (!requestOrigin || !env.CORS_ORIGIN.includes(requestOrigin)) {
        request.log.warn(
          { event: 'auth_failed', reason: 'origin_mismatch', url: request.url, ip: request.ip },
          'Authentication failed',
        );
        return reply.status(403).send({ error: 'Forbidden' });
      }
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');

    const now = new Date();
    const [session] = await sessionLookup.execute({
      tokenHash,
      expiresAt: now,
      idleSince: new Date(now.getTime() - env.SESSION_IDLE_TTL_MS),
    });

    if (!session) {
      request.log.warn(
        { event: 'auth_failed', reason: 'invalid_session', url: request.url, ip: request.ip },
        'Authentication failed',
      );
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    request.userId = session.userId;
    request.sessionId = session.id;
    void sessionTouch
      .execute({ id: session.id })
      .catch((err) => request.log.warn({ err, sessionId: session.id }, 'Failed to touch session'));
  });
});
