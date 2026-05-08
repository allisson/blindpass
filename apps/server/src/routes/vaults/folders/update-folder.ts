import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { FolderParamSchema, UpdateFolderRequestSchema } from '@blindpass/api-schema';
import { b64, toB64 } from '../../../utils/base64.js';
import { getVaultAccess } from '../../../vaults/access.js';
import * as folders from '../../../vaults/folders/repository.js';

export function registerUpdateFolderRoute(app: FastifyInstance): void {
  app
    .withTypeProvider<ZodTypeProvider>()
    .patch(
      '/vaults/:vaultId/folders/:folderId',
      { schema: { params: FolderParamSchema, body: UpdateFolderRequestSchema } },
      async (request, reply) => {
        const { vaultId, folderId } = request.params;
        const { encryptedName } = request.body;

        const access = await getVaultAccess(app.db, vaultId, request.userId);
        if (!access) return reply.status(404).send({ error: 'Vault not found' });
        if (access.role === 'viewer') return reply.status(403).send({ error: 'Forbidden' });

        const folder = await folders.update(app.db, folderId, vaultId, {
          encryptedNameCiphertext: b64(encryptedName.ciphertext),
          encryptedNameNonce: b64(encryptedName.nonce),
        });
        if (!folder) return reply.status(404).send({ error: 'Folder not found' });

        return reply.status(200).send({
          folder: {
            id: folder.id,
            encryptedName: {
              ciphertext: toB64(folder.encryptedNameCiphertext),
              nonce: toB64(folder.encryptedNameNonce),
            },
            createdAt: folder.createdAt.toISOString(),
            updatedAt: folder.updatedAt.toISOString(),
          },
        });
      },
    );
}
