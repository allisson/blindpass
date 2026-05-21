import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { DeleteAccountRequestSchema } from '@blindpass/api-schema';
import { deleteAccount } from '../../auth/account/service.js';
import { asTx } from '../../db/tx.js';
import { authRateLimit } from '../auth/rate-limit.js';
import { sendAuthFailure } from '../auth/result.js';

export function registerDeleteAccountRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().delete(
    '/user',
    {
      schema: { body: DeleteAccountRequestSchema },
      config: { rateLimit: authRateLimit(3) },
    },
    async (request, reply) => {
      const result = await app.db.transaction(async (tx) =>
        deleteAccount(
          asTx(tx),
          request.userId,
          {
            authenticatorCode: request.body.authenticatorCode,
          },
          app.clock,
        ),
      );

      if (!result.ok) return sendAuthFailure(reply, result.reason);

      return reply.status(200).send({ message: 'Account deleted' });
    },
  );
}
