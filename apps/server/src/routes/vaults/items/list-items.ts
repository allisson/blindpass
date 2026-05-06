import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, asc, desc, eq, gt, isNotNull, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { PaginationQuerySchema, VaultIdParamSchema } from '@blindpass/api-schema';
import { vaultItems, vaultItemVersions } from '../../../db/schema.js';
import { getVaultAccess } from '../vault-access.js';
import { toB64 } from '../../../utils/base64.js';

const QuerySchema = PaginationQuerySchema.extend({
  updatedAfter: z.iso.datetime().optional(),
  folderId: z.union([z.uuid(), z.literal('unfiled')]).optional(),
});

function mapItemRow(i: {
  id: string;
  folderId: string | null;
  createdAt: Date;
  updatedAt: Date;
  encryptedDataCiphertext: Buffer;
  encryptedDataNonce: Buffer;
  encryptedItemKeyCiphertext: Buffer;
  encryptedItemKeyNonce: Buffer;
}) {
  return {
    id: i.id,
    folderId: i.folderId,
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
  };
}

export function registerListItemsRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/vaults/:vaultId/items',
    {
      schema: { params: VaultIdParamSchema, querystring: QuerySchema },
    },
    async (request, reply) => {
      const { vaultId } = request.params;
      const { cursor, limit, updatedAfter, folderId } = request.query;

      const access = await getVaultAccess(app, vaultId, request.userId);
      if (!access) return reply.status(404).send({ error: 'Vault not found' });

      const folderCondition =
        folderId === 'unfiled'
          ? isNull(vaultItems.folderId)
          : folderId
            ? eq(vaultItems.folderId, folderId)
            : undefined;

      if (updatedAfter) {
        const since = new Date(updatedAfter);

        const [changedRows, deletedRows] = await Promise.all([
          app.db
            .selectDistinctOn([vaultItems.id], {
              id: vaultItems.id,
              folderId: vaultItems.folderId,
              createdAt: vaultItems.createdAt,
              updatedAt: vaultItems.updatedAt,
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
                isNull(vaultItems.deletedAt),
                gt(vaultItems.updatedAt, since),
                folderCondition,
              ),
            )
            .orderBy(asc(vaultItems.id), desc(vaultItemVersions.versionNum))
            .limit(1000),

          app.db
            .select({ id: vaultItems.id })
            .from(vaultItems)
            .where(
              and(
                eq(vaultItems.vaultId, vaultId),
                isNotNull(vaultItems.deletedAt),
                gt(vaultItems.updatedAt, since),
              ),
            )
            .limit(1000),
        ]);

        return reply.status(200).send({
          items: changedRows.map(mapItemRow),
          deletedIds: deletedRows.map((r) => r.id),
          serverTime: new Date().toISOString(),
        });
      }

      const rows = await app.db
        .selectDistinctOn([vaultItems.id], {
          id: vaultItems.id,
          folderId: vaultItems.folderId,
          createdAt: vaultItems.createdAt,
          updatedAt: vaultItems.updatedAt,
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
            isNull(vaultItems.deletedAt),
            cursor ? gt(vaultItems.id, cursor) : undefined,
            folderCondition,
          ),
        )
        .orderBy(asc(vaultItems.id), desc(vaultItemVersions.versionNum))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? page[page.length - 1].id : null;

      return reply.status(200).send({
        nextCursor,
        items: page.map(mapItemRow),
      });
    },
  );
}
