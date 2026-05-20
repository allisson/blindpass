import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { VaultItemParamSchema } from '@blindpass/api-schema';
import { purgeItem } from '../../../vaults/trash/service.js';
import { asTx } from '../../../db/tx.js';
import { sendVaultFailure } from '../result.js';

export function registerPurgeItemRoute(app: FastifyInstance): void {
  app
    .withTypeProvider<ZodTypeProvider>()
    .delete(
      '/vaults/:vaultId/trash/:id',
      { schema: { params: VaultItemParamSchema } },
      async (request, reply) => {
        const { vaultId, id } = request.params;
        const result = await app.db.transaction(async (tx) =>
          purgeItem(asTx(tx), request.userId, vaultId, id),
        );

        if (!result.ok)
          return sendVaultFailure(reply, result.reason, {
            item_not_found: [404, 'Item not found in trash'],
          });

        return reply.status(204).send();
      },
    );
}
