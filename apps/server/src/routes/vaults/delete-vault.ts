import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { VaultIdParamSchema } from '@blindpass/api-schema';
import { deleteVault } from '../../vaults/service.js';
import { asTx } from '../../db/tx.js';
import { sendVaultFailure } from './result.js';

export function registerDeleteVaultRoute(app: FastifyInstance): void {
  app
    .withTypeProvider<ZodTypeProvider>()
    .delete(
      '/vaults/:vaultId',
      { schema: { params: VaultIdParamSchema } },
      async (request, reply) => {
        const { vaultId } = request.params;
        const result = await app.db.transaction(async (tx) =>
          deleteVault(asTx(tx), request.userId, vaultId),
        );

        if (!result.ok)
          return sendVaultFailure(reply, result.reason, {
            last_vault: [422, 'Cannot delete your only vault'],
          });

        request.log.info({ event: 'vault_deleted', vaultId }, 'Vault deleted');
        return reply.status(204).send();
      },
    );
}
