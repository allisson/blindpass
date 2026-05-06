import type { FastifyInstance } from 'fastify';
import { and, desc, eq, ne } from 'drizzle-orm';
import { sessions } from '../../db/schema.js';

export function registerSessionsRoutes(app: FastifyInstance): void {
  app.get('/auth/sessions', async (request, reply) => {
    const rows = await app.db
      .select({
        id: sessions.id,
        createdAt: sessions.createdAt,
        lastUsedAt: sessions.lastUsedAt,
        userAgent: sessions.userAgent,
      })
      .from(sessions)
      .where(eq(sessions.userId, request.userId))
      .orderBy(desc(sessions.lastUsedAt));

    return reply.status(200).send({
      sessions: rows.map((r) => ({ ...r, isCurrent: r.id === request.sessionId })),
    });
  });

  app.delete<{ Params: { id: string } }>('/auth/sessions/:id', async (request, reply) => {
    const result = await app.db
      .delete(sessions)
      .where(and(eq(sessions.id, request.params.id), eq(sessions.userId, request.userId)))
      .returning({ id: sessions.id });

    if (result.length === 0) {
      return reply.status(404).send({ error: 'Session not found' });
    }
    return reply.status(204).send();
  });

  app.delete('/auth/sessions', async (request, reply) => {
    await app.db
      .delete(sessions)
      .where(and(eq(sessions.userId, request.userId), ne(sessions.id, request.sessionId)));

    return reply.status(204).send();
  });
}
