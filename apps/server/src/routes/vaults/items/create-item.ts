import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, eq } from 'drizzle-orm';
import { CreateItemRequestSchema, VaultIdParamSchema } from '@blindpass/api-schema';
import { vaultFolders, vaultItems, vaultItemVersions } from '../../../db/schema.js';
import { assertItemQuota, getEffectiveVaultItemQuota } from '../../../services/quota.js';
import { getVaultAccess } from '../vault-access.js';
import { b64, toB64 } from '../../../utils/base64.js';

export function registerCreateItemRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/vaults/:vaultId/items',
    {
      schema: { params: VaultIdParamSchema, body: CreateItemRequestSchema },
    },
    async (request, reply) => {
      const { vaultId } = request.params;
      const body = request.body;

      const access = await getVaultAccess(app, vaultId, request.userId);
      if (!access) return reply.status(404).send({ error: 'Vault not found' });
      if (access.role === 'viewer') return reply.status(403).send({ error: 'Forbidden' });

      if (body.folderId) {
        const [folder] = await app.db
          .select({ id: vaultFolders.id })
          .from(vaultFolders)
          .where(and(eq(vaultFolders.id, body.folderId), eq(vaultFolders.vaultId, vaultId)))
          .limit(1);
        if (!folder) return reply.status(404).send({ error: 'Folder not found' });
      }

      const { item, version } = await app.db.transaction(async (tx) => {
        const limit = await getEffectiveVaultItemQuota(tx, vaultId);
        await assertItemQuota(tx, vaultId, limit, 1);
        const [newItem] = await tx
          .insert(vaultItems)
          .values({ vaultId, folderId: body.folderId ?? null })
          .returning();
        const [newVersion] = await tx
          .insert(vaultItemVersions)
          .values({
            itemId: newItem.id,
            versionNum: 1,
            encryptedDataCiphertext: b64(body.encryptedData.ciphertext),
            encryptedDataNonce: b64(body.encryptedData.nonce),
            encryptedItemKeyCiphertext: b64(body.encryptedItemKey.ciphertext),
            encryptedItemKeyNonce: b64(body.encryptedItemKey.nonce),
          })
          .returning();
        return { item: newItem, version: newVersion };
      });

      return reply.status(201).send({
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
