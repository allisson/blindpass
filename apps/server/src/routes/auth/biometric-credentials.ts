import type { FastifyInstance } from 'fastify';
import { b64 } from '../../utils/base64.js';
import * as repo from '../../auth/biometric-credentials/repository.js';

export function registerBiometricCredentialsRoutes(app: FastifyInstance): void {
  app.post('/auth/biometric-credentials', async (request, reply) => {
    const { credentialId: credentialIdB64, label } = request.body as {
      credentialId: string;
      label?: string;
    };
    const credentialIdBuf = b64(credentialIdB64);
    const row = await repo.register(app.db, request.userId, credentialIdBuf, label);
    return reply.status(201).send({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
    });
  });

  app.get('/auth/biometric-credentials', async (request, reply) => {
    const rows = await repo.listForUser(app.db, request.userId);
    return reply.status(200).send({
      credentials: rows.map((r) => ({
        id: r.id,
        label: r.label ?? null,
        createdAt: r.createdAt.toISOString(),
        lastSeenAt: r.lastSeenAt.toISOString(),
      })),
    });
  });

  app.get<{ Params: { id: string } }>('/auth/biometric-credentials/:id', async (request, reply) => {
    const row = await repo.findByIdForUser(app.db, request.params.id, request.userId);
    if (!row) return reply.status(404).send({ error: 'Not found' });
    void repo.touchLastSeen(app.db, row.id).catch((err) => {
      app.log.debug({ err }, 'touchLastSeen failed');
    });
    return reply.status(200).send({
      id: row.id,
      label: row.label ?? null,
      createdAt: row.createdAt.toISOString(),
      lastSeenAt: row.lastSeenAt.toISOString(),
    });
  });

  app.delete<{ Params: { id: string } }>(
    '/auth/biometric-credentials/:id',
    async (request, reply) => {
      const deleted = await repo.deleteByIdForUser(app.db, request.params.id, request.userId);
      if (!deleted) return reply.status(404).send({ error: 'Not found' });
      return reply.status(204).send();
    },
  );
}
