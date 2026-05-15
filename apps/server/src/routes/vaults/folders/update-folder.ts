import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { FolderParamSchema, UpdateFolderRequestSchema } from '@blindpass/api-schema';
import { b64, toB64 } from '../../../utils/base64.js';
import { updateFolder } from '../../../vaults/folders/service.js';
import { asTx } from '../../../db/tx.js';

export function registerUpdateFolderRoute(app: FastifyInstance): void {
  app
    .withTypeProvider<ZodTypeProvider>()
    .patch(
      '/vaults/:vaultId/folders/:folderId',
      { schema: { params: FolderParamSchema, body: UpdateFolderRequestSchema } },
      async (request, reply) => {
        const { vaultId, folderId } = request.params;
        const { encryptedName } = request.body;

        const result = await app.db.transaction(async (tx) =>
          updateFolder(asTx(tx), request.userId, vaultId, folderId, {
            encryptedNameCiphertext: b64(encryptedName.ciphertext),
            encryptedNameNonce: b64(encryptedName.nonce),
          }),
        );

        if (!result.ok) {
          if (result.reason === 'forbidden') return reply.status(403).send({ error: 'Forbidden' });
          if (result.reason === 'folder_not_found')
            return reply.status(404).send({ error: 'Folder not found' });
          return reply.status(404).send({ error: 'Vault not found' });
        }

        return reply.status(200).send({
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
