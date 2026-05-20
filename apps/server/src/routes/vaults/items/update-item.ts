import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { UpdateItemRequestSchema, VaultItemParamSchema } from '@blindpass/api-schema';
import { b64 } from '../../../utils/base64.js';
import { updateItem } from '../../../vaults/items/service.js';
import { toEncryptedVaultItem } from '../../../vaults/items/mapper.js';
import { asTx } from '../../../db/tx.js';
import { sendVaultFailure } from '../result.js';

export function registerUpdateItemRoute(app: FastifyInstance): void {
  app
    .withTypeProvider<ZodTypeProvider>()
    .put(
      '/vaults/:vaultId/items/:id',
      { schema: { params: VaultItemParamSchema, body: UpdateItemRequestSchema } },
      async (request, reply) => {
        const { vaultId, id } = request.params;
        const body = request.body;

        const result = await app.db.transaction(async (tx) =>
          updateItem(asTx(tx), request.userId, vaultId, id, {
            encryptedDataCiphertext: b64(body.encryptedData.ciphertext),
            encryptedDataNonce: b64(body.encryptedData.nonce),
            encryptedItemKeyCiphertext: b64(body.encryptedItemKey.ciphertext),
            encryptedItemKeyNonce: b64(body.encryptedItemKey.nonce),
          }),
        );

        if (!result.ok)
          return sendVaultFailure(reply, result.reason, {
            item_not_found: [404, 'Item not found'],
          });

        return reply.status(200).send({ item: toEncryptedVaultItem(result.item) });
      },
    );
}
