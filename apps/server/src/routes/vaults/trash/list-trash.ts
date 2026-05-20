import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { PaginationQuerySchema, VaultIdParamSchema } from '@blindpass/api-schema';
import { toB64 } from '../../../utils/base64.js';
import { listTrash } from '../../../vaults/trash/service.js';

export function registerListTrashRoute(app: FastifyInstance): void {
  app
    .withTypeProvider<ZodTypeProvider>()
    .get(
      '/vaults/:vaultId/trash',
      { schema: { params: VaultIdParamSchema, querystring: PaginationQuerySchema } },
      async (request, reply) => {
        const { vaultId } = request.params;
        const { cursor, limit } = request.query;

        const result = await listTrash(app.db, request.userId, vaultId, cursor, limit);
        if (!result.ok) return reply.status(404).send({ error: 'Vault not found' });

        const hasMore = result.items.length > limit;
        const page = hasMore ? result.items.slice(0, limit) : result.items;
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
