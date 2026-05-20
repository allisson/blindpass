import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { VaultIdParamSchema } from '@blindpass/api-schema';
import { toB64 } from '../../../utils/base64.js';
import { listFolders } from '../../../vaults/folders/service.js';

export function registerListFoldersRoute(app: FastifyInstance): void {
  app
    .withTypeProvider<ZodTypeProvider>()
    .get(
      '/vaults/:vaultId/folders',
      { schema: { params: VaultIdParamSchema } },
      async (request, reply) => {
        const { vaultId } = request.params;

        const result = await listFolders(app.db, request.userId, vaultId);
        if (!result.ok) return reply.status(404).send({ error: 'Vault not found' });

        return reply.status(200).send({
          folders: result.folders.map((f) => ({
            id: f.id,
            encryptedName: {
              ciphertext: toB64(f.encryptedNameCiphertext),
              nonce: toB64(f.encryptedNameNonce),
            },
            createdAt: f.createdAt.toISOString(),
            updatedAt: f.updatedAt.toISOString(),
          })),
        });
      },
    );
}
