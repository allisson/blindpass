import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, eq, isNull, max } from 'drizzle-orm';
import { UpdateItemRequestSchema, VaultItemParamSchema } from '@blindpass/api-schema';
import { vaultItems, vaultItemVersions } from '../../../db/schema.js';
import { getVaultAccess } from '../vault-access.js';
import { b64, toB64 } from '../../../utils/base64.js';

export function registerUpdateItemRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().put(
    '/vaults/:vaultId/items/:id',
    {
      schema: { params: VaultItemParamSchema, body: UpdateItemRequestSchema },
    },
    async (request, reply) => {
      const { vaultId, id } = request.params;
      const body = request.body;

      const access = await getVaultAccess(app, vaultId, request.userId);
      if (!access) return reply.status(404).send({ error: 'Vault not found' });
      if (access.role === 'viewer') return reply.status(403).send({ error: 'Forbidden' });

      const result2 = await app.db.transaction(async (tx) => {
        const [existingItem] = await tx
          .select({ id: vaultItems.id })
          .from(vaultItems)
          .where(
            and(
              eq(vaultItems.id, id),
              eq(vaultItems.vaultId, vaultId),
              isNull(vaultItems.deletedAt),
            ),
          )
          .limit(1);

        if (!existingItem) return null;

        const [maxRow] = await tx
          .select({ max: max(vaultItemVersions.versionNum) })
          .from(vaultItemVersions)
          .where(eq(vaultItemVersions.itemId, id));

        const nextVersionNum = (maxRow?.max ?? 0) + 1;

        const [newVersion] = await tx
          .insert(vaultItemVersions)
          .values({
            itemId: id,
            versionNum: nextVersionNum,
            encryptedDataCiphertext: b64(body.encryptedData.ciphertext),
            encryptedDataNonce: b64(body.encryptedData.nonce),
            encryptedItemKeyCiphertext: b64(body.encryptedItemKey.ciphertext),
            encryptedItemKeyNonce: b64(body.encryptedItemKey.nonce),
          })
          .returning();

        const [updatedItem] = await tx
          .update(vaultItems)
          .set({ updatedAt: new Date() })
          .where(eq(vaultItems.id, id))
          .returning({
            id: vaultItems.id,
            folderId: vaultItems.folderId,
            createdAt: vaultItems.createdAt,
            updatedAt: vaultItems.updatedAt,
          });

        return { item: updatedItem, version: newVersion };
      });

      if (!result2) return reply.status(404).send({ error: 'Item not found' });

      const { item, version } = result2;

      return reply.status(200).send({
        item: {
          id: item.id,
          folderId: item.folderId,
          encryptedData: {
            ciphertext: toB64(version.encryptedDataCiphertext),
            nonce: toB64(version.encryptedDataNonce),
          },
          encryptedItemKey: {
            ciphertext: toB64(version.encryptedItemKeyCiphertext),
            nonce: toB64(version.encryptedItemKeyNonce),
          },
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        },
      });
    },
  );
}
