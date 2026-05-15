import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { emptyUserTrash } from '../../../vaults/trash/service.js';
import { asTx } from '../../../db/tx.js';

export function registerEmptyUserTrashRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().delete('/user/trash', {}, async (request, reply) => {
    await app.db.transaction(async (tx) => emptyUserTrash(asTx(tx), request.userId));
    return reply.status(204).send();
  });
}
