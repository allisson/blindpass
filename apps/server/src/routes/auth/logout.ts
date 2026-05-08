import type { FastifyInstance } from 'fastify';
import * as session from '../../auth/session/index.js';
import * as sessions from '../../auth/sessions/repository.js';

export function registerLogoutRoute(app: FastifyInstance): void {
  app.post('/auth/logout', async (request, reply) => {
    await sessions.deleteById(app.db, request.sessionId);
    session.clearCookie(reply);
    return reply.status(204).send();
  });
}
