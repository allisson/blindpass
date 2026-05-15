import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { VaultIdParamSchema } from '@blindpass/api-schema';
import { emptyVaultTrash } from '../../../vaults/trash/service.js';
import { asTx } from '../../../db/tx.js';

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

        if (!result.ok) {
          if (result.reason === 'forbidden') return reply.status(403).send({ error: 'Forbidden' });
          return reply.status(404).send({ error: 'Vault not found' });
        }

        return reply.status(204).send();
      },
    );
}
