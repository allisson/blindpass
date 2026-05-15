import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { MoveItemRequestSchema, VaultItemParamSchema } from '@blindpass/api-schema';
import { moveItem } from '../../../vaults/items/service.js';
import { asTx } from '../../../db/tx.js';

export function registerMoveItemRoute(app: FastifyInstance): void {
  app
    .withTypeProvider<ZodTypeProvider>()
    .patch(
      '/vaults/:vaultId/items/:id/folder',
      { schema: { params: VaultItemParamSchema, body: MoveItemRequestSchema } },
      async (request, reply) => {
        const { vaultId, id } = request.params;
        const { folderId } = request.body;

        const result = await app.db.transaction(async (tx) =>
          moveItem(asTx(tx), request.userId, vaultId, id, folderId),
        );

        if (!result.ok) {
          if (result.reason === 'forbidden') return reply.status(403).send({ error: 'Forbidden' });
          if (result.reason === 'folder_not_found')
            return reply.status(404).send({ error: 'Folder not found' });
          if (result.reason === 'item_not_found')
            return reply.status(404).send({ error: 'Item not found' });
          return reply.status(404).send({ error: 'Vault not found' });
        }

        return reply.status(204).send();
      },
    );
}
