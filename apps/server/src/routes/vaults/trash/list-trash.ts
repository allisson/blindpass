import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, asc, desc, eq, gt, isNotNull } from 'drizzle-orm';
import { PaginationQuerySchema, VaultIdParamSchema } from '@blindpass/api-schema';
import { vaultItems, vaultItemVersions } from '../../../db/schema.js';
import { getVaultAccess } from '../vault-access.js';
import { toB64 } from '../../../utils/base64.js';

export function registerListTrashRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/vaults/:vaultId/trash',
    {
      schema: { params: VaultIdParamSchema, querystring: PaginationQuerySchema },
    },
    async (request, reply) => {
      const { vaultId } = request.params;
      const { cursor, limit } = request.query;

      const access = await getVaultAccess(app, vaultId, request.userId);
      if (!access) return reply.status(404).send({ error: 'Vault not found' });

      const rows = await app.db
        .selectDistinctOn([vaultItems.id], {
          id: vaultItems.id,
          createdAt: vaultItems.createdAt,
          updatedAt: vaultItems.updatedAt,
          deletedAt: vaultItems.deletedAt,
          encryptedDataCiphertext: vaultItemVersions.encryptedDataCiphertext,
          encryptedDataNonce: vaultItemVersions.encryptedDataNonce,
          encryptedItemKeyCiphertext: vaultItemVersions.encryptedItemKeyCiphertext,
          encryptedItemKeyNonce: vaultItemVersions.encryptedItemKeyNonce,
        })
        .from(vaultItems)
        .innerJoin(vaultItemVersions, eq(vaultItemVersions.itemId, vaultItems.id))
        .where(
          and(
            eq(vaultItems.vaultId, vaultId),
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
