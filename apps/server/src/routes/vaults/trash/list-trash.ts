import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { PaginationQuerySchema, VaultIdParamSchema } from '@blindpass/api-schema';
import { toB64 } from '../../../utils/base64.js';
import { getVaultAccess } from '../../../vaults/access.js';
import * as trash from '../../../vaults/trash/repository.js';

export function registerListTrashRoute(app: FastifyInstance): void {
  app
    .withTypeProvider<ZodTypeProvider>()
    .get(
      '/vaults/:vaultId/trash',
      { schema: { params: VaultIdParamSchema, querystring: PaginationQuerySchema } },
      async (request, reply) => {
        const { vaultId } = request.params;
        const { cursor, limit } = request.query;

        const access = await getVaultAccess(app.db, vaultId, request.userId);
        if (!access) return reply.status(404).send({ error: 'Vault not found' });

        const rows = await trash.listForVault(app.db, vaultId, cursor, limit);
        const hasMore = rows.length > limit;
        const page = hasMore ? rows.slice(0, limit) : rows;
        const nextCursor = hasMore ? page[page.length - 1].id : null;

        return reply.status(200).send({
          nextCursor,
          items: page.map((i) => ({
            id: i.id,
            encryptedData: {
              ciphertext: toB64(i.encryptedDataCiphertext),
              nonce: toB64(i.encryptedDataNonce),
            },
            encryptedItemKey: {
              ciphertext: toB64(i.encryptedItemKeyCiphertext),
              nonce: toB64(i.encryptedItemKeyNonce),
            },
            createdAt: i.createdAt.toISOString(),
            updatedAt: i.updatedAt.toISOString(),
            deletedAt: i.deletedAt!.toISOString(),
          })),
        });
      },
    );
}
