import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { CreateFolderRequestSchema, VaultIdParamSchema } from '@blindpass/api-schema';
import { vaultFolders } from '../../../db/schema.js';
import { getVaultAccess } from '../vault-access.js';
import { b64, toB64 } from '../../../utils/base64.js';

export function registerCreateFolderRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/vaults/:vaultId/folders',
    {
      schema: { params: VaultIdParamSchema, body: CreateFolderRequestSchema },
    },
    async (request, reply) => {
      const { vaultId } = request.params;
      const { encryptedName } = request.body;

      const access = await getVaultAccess(app, vaultId, request.userId);
      if (!access) return reply.status(404).send({ error: 'Vault not found' });
      if (access.role === 'viewer') return reply.status(403).send({ error: 'Forbidden' });

      const [folder] = await app.db
        .insert(vaultFolders)
        .values({
          vaultId,
          encryptedNameCiphertext: b64(encryptedName.ciphertext),
          encryptedNameNonce: b64(encryptedName.nonce),
        })
        .returning();

      return reply.status(201).send({
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
