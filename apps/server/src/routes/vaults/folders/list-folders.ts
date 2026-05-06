import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { eq } from 'drizzle-orm';
import { VaultIdParamSchema } from '@blindpass/api-schema';
import { vaultFolders } from '../../../db/schema.js';
import { getVaultAccess } from '../vault-access.js';
import { toB64 } from '../../../utils/base64.js';

export function registerListFoldersRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/vaults/:vaultId/folders',
    {
      schema: { params: VaultIdParamSchema },
    },
    async (request, reply) => {
      const { vaultId } = request.params;

      const access = await getVaultAccess(app, vaultId, request.userId);
      if (!access) return reply.status(404).send({ error: 'Vault not found' });

      const rows = await app.db
        .select()
        .from(vaultFolders)
        .where(eq(vaultFolders.vaultId, vaultId));

      return reply.status(200).send({
        folders: rows.map((f) => ({
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
