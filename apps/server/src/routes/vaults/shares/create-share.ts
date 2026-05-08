import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { CreateShareRequestSchema, VaultIdParamSchema } from '@blindpass/api-schema';
import { b64 } from '../../../utils/base64.js';
import { createShare } from '../../../vaults/shares/service.js';

function getPgCode(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  if ('code' in err) return (err as { code: string }).code;
  if ('cause' in err) return getPgCode((err as { cause: unknown }).cause);
  return undefined;
}

export function registerCreateShareRoute(app: FastifyInstance): void {
  app
    .withTypeProvider<ZodTypeProvider>()
    .post(
      '/vaults/:vaultId/shares',
      { schema: { params: VaultIdParamSchema, body: CreateShareRequestSchema } },
      async (request, reply) => {
        const { vaultId } = request.params;
        const { receiverUserId, sealedVaultKey, role } = request.body;

        try {
          const result = await createShare(app.db, request.userId, vaultId, {
            receiverUserId,
            sealedVaultKey: b64(sealedVaultKey),
            role: role ?? 'viewer',
          });

          if (!result.ok) {
            if (result.reason === 'cannot_share_with_self')
              return reply.status(400).send({ error: 'cannot_share_with_self' });
            if (result.reason === 'receiver_not_found')
              return reply.status(404).send({ error: 'Receiver not found' });
            return reply.status(404).send({ error: 'Vault not found' });
          }

          request.log.info(
            { event: 'vault_shared', vaultId, receiverUserId, role: result.share.role },
            'Vault shared',
          );

          return reply.status(201).send({
            share: {
              id: result.share.id,
              receiverUserId: result.share.receiverUserId,
              receiverUsername: result.share.receiverUsername,
              role: result.share.role,
              createdAt: result.share.createdAt.toISOString(),
            },
          });
        } catch (err: unknown) {
          if (getPgCode(err) === '23505') {
            return reply.status(409).send({ error: 'Already shared with this user' });
          }
          throw err;
        }
      },
    );
}
