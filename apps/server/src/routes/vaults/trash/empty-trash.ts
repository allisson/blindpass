import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { VaultIdParamSchema } from '@blindpass/api-schema';
import { emptyVaultTrash } from '../../../vaults/trash/service.js';
import { asTx } from '../../../db/tx.js';
import { sendVaultFailure } from '../result.js';

export function registerEmptyTrashRoute(app: FastifyInstance): void {
  app
    .withTypeProvider<ZodTypeProvider>()
    .delete(
      '/vaults/:vaultId/trash',
      { schema: { params: VaultIdParamSchema } },
      async (request, reply) => {
        const { vaultId } = request.params;
        const result = await app.db.transaction(async (tx) =>
          emptyVaultTrash(asTx(tx), request.userId, vaultId),
        );

        if (!result.ok) return sendVaultFailure(reply, result.reason);

        return reply.status(204).send();
      },
    );
}
