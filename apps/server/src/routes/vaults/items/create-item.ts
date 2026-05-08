import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { CreateItemRequestSchema, VaultIdParamSchema } from '@blindpass/api-schema';
import { b64 } from '../../../utils/base64.js';
import { createItem } from '../../../vaults/items/service.js';
import { toEncryptedVaultItem } from '../../../vaults/items/mapper.js';

export function registerCreateItemRoute(app: FastifyInstance): void {
  app
    .withTypeProvider<ZodTypeProvider>()
    .post(
      '/vaults/:vaultId/items',
      { schema: { params: VaultIdParamSchema, body: CreateItemRequestSchema } },
      async (request, reply) => {
        const { vaultId } = request.params;
        const body = request.body;

        const result = await app.db.transaction(async (tx) =>
          createItem(tx, request.userId, vaultId, {
            folderId: body.folderId ?? null,
            encryptedDataCiphertext: b64(body.encryptedData.ciphertext),
            encryptedDataNonce: b64(body.encryptedData.nonce),
            encryptedItemKeyCiphertext: b64(body.encryptedItemKey.ciphertext),
            encryptedItemKeyNonce: b64(body.encryptedItemKey.nonce),
          }),
        );

        if (!result.ok) {
          if (result.reason === 'forbidden') return reply.status(403).send({ error: 'Forbidden' });
          if (result.reason === 'folder_not_found')
            return reply.status(404).send({ error: 'Folder not found' });
          return reply.status(404).send({ error: 'Vault not found' });
        }

        return reply.status(201).send({ item: toEncryptedVaultItem(result.item) });
      },
    );
}
