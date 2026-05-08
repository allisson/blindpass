import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { emptyUserTrash } from '../../../vaults/trash/service.js';

export function registerEmptyUserTrashRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().delete('/user/trash', {}, async (request, reply) => {
    await emptyUserTrash(app.db, request.userId);
    return reply.status(204).send();
  });
}
