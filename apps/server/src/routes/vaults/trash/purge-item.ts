import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { VaultItemParamSchema } from '@blindpass/api-schema';
import { purgeItem } from '../../../vaults/trash/service.js';

export function registerPurgeItemRoute(app: FastifyInstance): void {
  app
    .withTypeProvider<ZodTypeProvider>()
    .delete(
      '/vaults/:vaultId/trash/:id',
      { schema: { params: VaultItemParamSchema } },
      async (request, reply) => {
        const { vaultId, id } = request.params;
        const result = await purgeItem(app.db, request.userId, vaultId, id);

        if (!result.ok) {
          if (result.reason === 'forbidden') return reply.status(403).send({ error: 'Forbidden' });
          if (result.reason === 'item_not_found')
            return reply.status(404).send({ error: 'Item not found in trash' });
          return reply.status(404).send({ error: 'Vault not found' });
        }

        return reply.status(204).send();
      },
    );
}
