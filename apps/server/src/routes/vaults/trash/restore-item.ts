import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { VaultItemParamSchema } from '@blindpass/api-schema';
import { restoreItem } from '../../../vaults/trash/service.js';
import { asTx } from '../../../db/tx.js';
import { sendVaultFailure } from '../result.js';

export function registerRestoreItemRoute(app: FastifyInstance): void {
  app
    .withTypeProvider<ZodTypeProvider>()
    .post(
      '/vaults/:vaultId/trash/:id/restore',
      { schema: { params: VaultItemParamSchema } },
      async (request, reply) => {
        const { vaultId, id } = request.params;
        const result = await app.db.transaction(async (tx) =>
          restoreItem(asTx(tx), request.userId, vaultId, id),
        );

        if (!result.ok)
          return sendVaultFailure(reply, result.reason, {
            item_not_found: [404, 'Item not found in trash'],
          });

        return reply.status(204).send();
      },
    );
}
