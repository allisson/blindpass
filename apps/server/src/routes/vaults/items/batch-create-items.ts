import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { BatchCreateItemsRequestSchema, VaultIdParamSchema } from '@blindpass/api-schema';
import { b64 } from '../../../utils/base64.js';
import { batchCreateItems } from '../../../vaults/items/service.js';
import { asTx } from '../../../db/tx.js';
import { sendVaultFailure } from '../result.js';

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

      const result = await app.db.transaction(async (tx) =>
        batchCreateItems(
          asTx(tx),
          request.userId,
          vaultId,
          items.map((it) => ({
            folderId: it.folderId ?? null,
            encryptedDataCiphertext: b64(it.encryptedData.ciphertext),
            encryptedDataNonce: b64(it.encryptedData.nonce),
            encryptedItemKeyCiphertext: b64(it.encryptedItemKey.ciphertext),
            encryptedItemKeyNonce: b64(it.encryptedItemKey.nonce),
          })),
        ),
      );

      if (!result.ok) return sendVaultFailure(reply, result.reason);

      return reply.status(201).send({
        items: result.items.map((r) => ({
          id: r.id,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        })),
      });
    },
  );
}
