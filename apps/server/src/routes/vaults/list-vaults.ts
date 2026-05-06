import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, asc, eq, gt } from 'drizzle-orm';
import { PaginationQuerySchema } from '@blindpass/api-schema';
import { vaults, vaultShares, users } from '../../db/schema.js';
import { toB64 } from '../../utils/base64.js';

export function registerListVaultsRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/vaults',
    {
      schema: { querystring: PaginationQuerySchema },
    },
    async (request, reply) => {
      const { cursor, limit } = request.query;

      const [ownedVaults, sharedRows] = await Promise.all([
        app.db
          .select()
          .from(vaults)
          .where(and(eq(vaults.userId, request.userId), cursor ? gt(vaults.id, cursor) : undefined))
          .orderBy(asc(vaults.id))
          .limit(limit + 1),
        app.db
          .select({
            shareId: vaultShares.id,
            sealedVaultKey: vaultShares.sealedVaultKey,
            role: vaultShares.role,
            vaultId: vaults.id,
            encryptedVaultDataCiphertext: vaults.encryptedVaultDataCiphertext,
            encryptedVaultDataNonce: vaults.encryptedVaultDataNonce,
            ownerUsername: users.username,
            createdAt: vaults.createdAt,
            updatedAt: vaults.updatedAt,
          })
          .from(vaultShares)
          .innerJoin(vaults, eq(vaults.id, vaultShares.vaultId))
          .innerJoin(users, eq(users.id, vaultShares.ownerUserId))
          .where(
            and(
              eq(vaultShares.receiverUserId, request.userId),
              cursor ? gt(vaults.id, cursor) : undefined,
            ),
          )
          .orderBy(asc(vaults.id))
          .limit(limit + 1),
      ]);

      const owned = ownedVaults.map((v) => ({
        id: v.id,
        isShared: false as const,
        encryptedVaultKey: {
          ciphertext: toB64(v.encryptedVaultKeyCiphertext),
          nonce: toB64(v.encryptedVaultKeyNonce),
        },
        encryptedVaultData: {
          ciphertext: toB64(v.encryptedVaultDataCiphertext),
          nonce: toB64(v.encryptedVaultDataNonce),
        },
        createdAt: v.createdAt.toISOString(),
        updatedAt: v.updatedAt.toISOString(),
      }));

      const shared = sharedRows.map((r) => ({
        id: r.vaultId,
        isShared: true as const,
        shareId: r.shareId,
        role: r.role as 'viewer' | 'editor',
        sealedVaultKey: toB64(r.sealedVaultKey),
        ownerUsername: r.ownerUsername,
        encryptedVaultData: {
          ciphertext: toB64(r.encryptedVaultDataCiphertext),
          nonce: toB64(r.encryptedVaultDataNonce),
        },
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }));

      const all = [...owned, ...shared].sort((a, b) => a.id.localeCompare(b.id));
      const hasMore = all.length > limit;
      const page = hasMore ? all.slice(0, limit) : all;
      const nextCursor = hasMore ? page[page.length - 1].id : null;

      return reply.status(200).send({ nextCursor, vaults: page });
    },
  );
}
