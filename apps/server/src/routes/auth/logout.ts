import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { sessions } from '../../db/schema.js';
import { env } from '../../env.js';

export function registerLogoutRoute(app: FastifyInstance): void {
  app.post('/auth/logout', async (request, reply) => {
    await app.db.delete(sessions).where(eq(sessions.id, request.sessionId));
    reply.clearCookie(env.COOKIE_NAME, {
      path: '/',
      domain: env.COOKIE_DOMAIN,
    });
    return reply.status(204).send();
  });
}
