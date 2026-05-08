import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { PaginationQuerySchema } from '@blindpass/api-schema';
import { toB64 } from '../../../utils/base64.js';
import * as trash from '../../../vaults/trash/repository.js';

export function registerListUserTrashRoute(app: FastifyInstance): void {
  app
    .withTypeProvider<ZodTypeProvider>()
    .get(
      '/user/trash',
      { schema: { querystring: PaginationQuerySchema } },
      async (request, reply) => {
        const { cursor, limit } = request.query;
        const rows = await trash.listForUser(app.db, request.userId, cursor, limit);
        const hasMore = rows.length > limit;
        const page = hasMore ? rows.slice(0, limit) : rows;
        const nextCursor = hasMore ? page[page.length - 1].id : null;

        return reply.status(200).send({
          nextCursor,
          items: page.map((i) => ({
            id: i.id,
            vaultId: i.vaultId,
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
