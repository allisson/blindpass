import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { BatchCreateItemsRequestSchema, VaultIdParamSchema } from '@blindpass/api-schema';
import { uuidv7 } from 'uuidv7';
import { vaultItems, vaultItemVersions } from '../../../db/schema.js';
import { assertItemQuota, getEffectiveVaultItemQuota } from '../../../services/quota.js';
import { getVaultAccess } from '../vault-access.js';
import { b64 } from '../../../utils/base64.js';

export function registerBatchCreateItemsRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/vaults/:vaultId/items/batch',
    {
      bodyLimit: 10 * 1024 * 1024,
      schema: { params: VaultIdParamSchema, body: BatchCreateItemsRequestSchema },
    },
    async (request, reply) => {
      const { vaultId } = request.params;
      const { items } = request.body;

      const access = await getVaultAccess(app, vaultId, request.userId);
      if (!access) return reply.status(404).send({ error: 'Vault not found' });
      if (access.role === 'viewer') return reply.status(403).send({ error: 'Forbidden' });

      const created = await app.db.transaction(async (tx) => {
        const limit = await getEffectiveVaultItemQuota(tx, vaultId);
        await assertItemQuota(tx, vaultId, limit, items.length);
        const ids = items.map(() => uuidv7());

        const newItems = await tx
          .insert(vaultItems)
          .values(ids.map((id, i) => ({ id, vaultId, folderId: items[i]!.folderId ?? null })))
          .returning();

        await tx.insert(vaultItemVersions).values(
          ids.map((id, i) => ({
            itemId: id,
            versionNum: 1,
            encryptedDataCiphertext: b64(items[i]!.encryptedData.ciphertext),
            encryptedDataNonce: b64(items[i]!.encryptedData.nonce),
            encryptedItemKeyCiphertext: b64(items[i]!.encryptedItemKey.ciphertext),
            encryptedItemKeyNonce: b64(items[i]!.encryptedItemKey.nonce),
          })),
        );

        const itemMap = new Map(newItems.map((r) => [r.id, r]));
        return ids.map((id) => {
          const r = itemMap.get(id)!;
          return {
            id: r.id,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
          };
        });
      });

      return reply.status(201).send({ items: created });
    },
  );
}
