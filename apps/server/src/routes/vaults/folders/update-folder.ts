import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, eq } from 'drizzle-orm';
import { FolderParamSchema, UpdateFolderRequestSchema } from '@blindpass/api-schema';
import { vaultFolders } from '../../../db/schema.js';
import { getVaultAccess } from '../vault-access.js';
import { b64, toB64 } from '../../../utils/base64.js';

export function registerUpdateFolderRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().patch(
    '/vaults/:vaultId/folders/:folderId',
    {
      schema: { params: FolderParamSchema, body: UpdateFolderRequestSchema },
    },
    async (request, reply) => {
      const { vaultId, folderId } = request.params;
      const { encryptedName } = request.body;

      const access = await getVaultAccess(app, vaultId, request.userId);
      if (!access) return reply.status(404).send({ error: 'Vault not found' });
      if (access.role === 'viewer') return reply.status(403).send({ error: 'Forbidden' });

      const [folder] = await app.db
        .update(vaultFolders)
        .set({
          encryptedNameCiphertext: b64(encryptedName.ciphertext),
          encryptedNameNonce: b64(encryptedName.nonce),
          updatedAt: new Date(),
        })
        .where(and(eq(vaultFolders.id, folderId), eq(vaultFolders.vaultId, vaultId)))
        .returning();

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
