import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { CreateFolderRequestSchema, VaultIdParamSchema } from '@blindpass/api-schema';
import { b64, toB64 } from '../../../utils/base64.js';
import { createFolder } from '../../../vaults/folders/service.js';
import { asTx } from '../../../db/tx.js';

export function registerCreateFolderRoute(app: FastifyInstance): void {
  app
    .withTypeProvider<ZodTypeProvider>()
    .post(
      '/vaults/:vaultId/folders',
      { schema: { params: VaultIdParamSchema, body: CreateFolderRequestSchema } },
      async (request, reply) => {
        const { vaultId } = request.params;
        const { encryptedName } = request.body;

        const result = await app.db.transaction(async (tx) =>
          createFolder(asTx(tx), request.userId, vaultId, {
            encryptedNameCiphertext: b64(encryptedName.ciphertext),
            encryptedNameNonce: b64(encryptedName.nonce),
          }),
        );

        if (!result.ok) {
          if (result.reason === 'forbidden') return reply.status(403).send({ error: 'Forbidden' });
          return reply.status(404).send({ error: 'Vault not found' });
        }

        return reply.status(201).send({
          folder: {
            id: result.folder.id,
            encryptedName: {
              ciphertext: toB64(result.folder.encryptedNameCiphertext),
              nonce: toB64(result.folder.encryptedNameNonce),
            },
            createdAt: result.folder.createdAt.toISOString(),
            updatedAt: result.folder.updatedAt.toISOString(),
          },
        });
      },
    );
}
