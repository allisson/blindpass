import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { ShareParamSchema } from '@blindpass/api-schema';
import { deleteShare } from '../../../vaults/shares/service.js';
import { asTx } from '../../../db/tx.js';

export function registerDeleteShareRoute(app: FastifyInstance): void {
  app
    .withTypeProvider<ZodTypeProvider>()
    .delete(
      '/vaults/:vaultId/shares/:shareId',
      { schema: { params: ShareParamSchema } },
      async (request, reply) => {
        const { vaultId, shareId } = request.params;
        const result = await app.db.transaction(async (tx) =>
          deleteShare(asTx(tx), request.userId, vaultId, shareId),
        );

        if (!result.ok) {
          return reply.status(404).send({ error: 'Share not found' });
        }

        request.log.info({ event: 'share_revoked', vaultId, shareId }, 'Share revoked');
        return reply.status(204).send();
      },
    );
}
