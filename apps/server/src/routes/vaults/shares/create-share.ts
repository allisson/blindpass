import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, eq } from 'drizzle-orm';
import { CreateShareRequestSchema, VaultIdParamSchema } from '@blindpass/api-schema';
import { vaults, vaultShares, users } from '../../../db/schema.js';
import { b64 } from '../../../utils/base64.js';

function getPgCode(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  if ('code' in err) return (err as { code: string }).code;
  if ('cause' in err) return getPgCode((err as { cause: unknown }).cause);
  return undefined;
}

export function registerCreateShareRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/vaults/:vaultId/shares',
    {
      schema: { params: VaultIdParamSchema, body: CreateShareRequestSchema },
    },
    async (request, reply) => {
      const { vaultId } = request.params;
      const { receiverUserId, sealedVaultKey, role } = request.body;

      if (receiverUserId === request.userId) {
        return reply.status(400).send({ error: 'cannot_share_with_self' });
      }

      const [vault] = await app.db
        .select({ id: vaults.id })
        .from(vaults)
        .where(and(eq(vaults.id, vaultId), eq(vaults.userId, request.userId)))
        .limit(1);

      if (!vault) return reply.status(404).send({ error: 'Vault not found' });

      const [sender] = await app.db
        .select({ username: users.username })
        .from(users)
        .where(eq(users.id, request.userId))
        .limit(1);

      if (!sender) return reply.status(500).send({ error: 'Internal error' });

      const [receiver] = await app.db
        .select({ id: users.id, username: users.username })
        .from(users)
        .where(and(eq(users.id, receiverUserId), eq(users.verified, true)))
        .limit(1);

      if (!receiver) return reply.status(404).send({ error: 'Receiver not found' });

      let shareId: string;
      try {
        const [inserted] = await app.db
          .insert(vaultShares)
          .values({
            vaultId,
            ownerUserId: request.userId,
            receiverUserId,
            sealedVaultKey: b64(sealedVaultKey),
            role: role ?? 'viewer',
          })
          .returning({ id: vaultShares.id, createdAt: vaultShares.createdAt });

        shareId = inserted.id;

        request.log.info({ event: 'vault_shared', vaultId, receiverUserId, role }, 'Vault shared');

        void sender;

        return reply.status(201).send({
          share: {
            id: shareId,
            receiverUserId,
            receiverUsername: receiver.username,
            role: role as 'viewer' | 'editor',
            createdAt: inserted.createdAt.toISOString(),
          },
        });
      } catch (err: unknown) {
        const pgCode = getPgCode(err);
        if (pgCode === '23505') {
          return reply.status(409).send({ error: 'Already shared with this user' });
        }
        throw err;
      }
    },
  );
}
