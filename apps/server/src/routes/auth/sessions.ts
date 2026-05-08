import type { FastifyInstance } from 'fastify';
import * as sessions from '../../auth/sessions/repository.js';

export function registerSessionsRoutes(app: FastifyInstance): void {
  app.get('/auth/sessions', async (request, reply) => {
    const rows = await sessions.listForUser(app.db, request.userId);
    return reply.status(200).send({
      sessions: rows.map((r) => ({ ...r, isCurrent: r.id === request.sessionId })),
    });
  });

  app.delete<{ Params: { id: string } }>('/auth/sessions/:id', async (request, reply) => {
    const deleted = await sessions.deleteByIdForUser(app.db, request.params.id, request.userId);
    if (!deleted) {
      return reply.status(404).send({ error: 'Session not found' });
    }
    return reply.status(204).send();
  });

  app.delete('/auth/sessions', async (request, reply) => {
    await sessions.deleteAllForUserExcept(app.db, request.userId, request.sessionId);
    return reply.status(204).send();
  });
}
