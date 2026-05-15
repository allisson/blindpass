import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { VaultItemParamSchema } from '@blindpass/api-schema';
import { deleteItem } from '../../../vaults/items/service.js';
import { asTx } from '../../../db/tx.js';

export function registerDeleteItemRoute(app: FastifyInstance): void {
  app
    .withTypeProvider<ZodTypeProvider>()
    .delete(
      '/vaults/:vaultId/items/:id',
      { schema: { params: VaultItemParamSchema } },
      async (request, reply) => {
        const { vaultId, id } = request.params;
        const result = await app.db.transaction(async (tx) =>
          deleteItem(asTx(tx), request.userId, vaultId, id),
        );

        if (!result.ok) {
          if (result.reason === 'forbidden') return reply.status(403).send({ error: 'Forbidden' });
          if (result.reason === 'item_not_found')
            return reply.status(404).send({ error: 'Item not found' });
          return reply.status(404).send({ error: 'Vault not found' });
        }

        return reply.status(204).send();
      },
    );
}
