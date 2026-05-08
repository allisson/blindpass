import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { VaultItemParamSchema } from '@blindpass/api-schema';
import { restoreItem } from '../../../vaults/trash/service.js';

export function registerRestoreItemRoute(app: FastifyInstance): void {
  app
    .withTypeProvider<ZodTypeProvider>()
    .post(
      '/vaults/:vaultId/trash/:id/restore',
      { schema: { params: VaultItemParamSchema } },
      async (request, reply) => {
        const { vaultId, id } = request.params;
        const result = await restoreItem(app.db, request.userId, vaultId, id);

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
