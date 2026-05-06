import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, asc, desc, eq, gt, isNotNull, or } from 'drizzle-orm';
import { PaginationQuerySchema } from '@blindpass/api-schema';
import { vaults, vaultItems, vaultItemVersions, vaultShares } from '../../../db/schema.js';
import { toB64 } from '../../../utils/base64.js';

export function registerListUserTrashRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/user/trash',
    {
      schema: { querystring: PaginationQuerySchema },
    },
    async (request, reply) => {
      const { cursor, limit } = request.query;

      const rows = await app.db
        .selectDistinctOn([vaultItems.id], {
          id: vaultItems.id,
          vaultId: vaultItems.vaultId,
          createdAt: vaultItems.createdAt,
          updatedAt: vaultItems.updatedAt,
          deletedAt: vaultItems.deletedAt,
          encryptedDataCiphertext: vaultItemVersions.encryptedDataCiphertext,
          encryptedDataNonce: vaultItemVersions.encryptedDataNonce,
          encryptedItemKeyCiphertext: vaultItemVersions.encryptedItemKeyCiphertext,
          encryptedItemKeyNonce: vaultItemVersions.encryptedItemKeyNonce,
        })
        .from(vaultItems)
        .innerJoin(vaults, eq(vaults.id, vaultItems.vaultId))
        .leftJoin(vaultShares, eq(vaultShares.vaultId, vaults.id))
        .innerJoin(vaultItemVersions, eq(vaultItemVersions.itemId, vaultItems.id))
        .where(
          and(
            or(eq(vaults.userId, request.userId), eq(vaultShares.receiverUserId, request.userId)),
            isNotNull(vaultItems.deletedAt),
            cursor ? gt(vaultItems.id, cursor) : undefined,
          ),
        )
        .orderBy(asc(vaultItems.id), desc(vaultItemVersions.versionNum))
        .limit(limit + 1);

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
