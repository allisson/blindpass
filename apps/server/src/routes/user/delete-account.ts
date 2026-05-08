import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { DeleteAccountRequestSchema } from '@blindpass/api-schema';
import { deleteAccount } from '../../auth/account/service.js';
import { authRateLimit } from '../auth/rate-limit.js';

export function registerDeleteAccountRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().delete(
    '/user',
    {
      schema: { body: DeleteAccountRequestSchema },
      config: { rateLimit: authRateLimit(3) },
    },
    async (request, reply) => {
      const result = await app.db.transaction(async (tx) =>
        deleteAccount(tx, request.userId, {
          authenticatorCode: request.body.authenticatorCode,
        }),
      );

      if (!result.ok) {
        if (result.reason === 'admin_user_protected') {
          return reply.status(403).send({ error: 'admin_user_protected' });
        }
        return reply.status(400).send({ error: 'Invalid authenticator code' });
      }

      return reply.status(200).send({ message: 'Account deleted' });
    },
  );
}
