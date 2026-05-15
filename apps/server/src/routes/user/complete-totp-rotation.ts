import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { CompleteTotpRotationRequestSchema } from '@blindpass/api-schema';
import { completeRotation } from '../../auth/totp-rotation/service.js';
import { asTx } from '../../db/tx.js';

export function registerCompleteTotpRotationRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/user/totp/rotate/complete',
    {
      schema: { body: CompleteTotpRotationRequestSchema },
      config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      const result = await app.db.transaction(async (tx) =>
        completeRotation(
          asTx(tx),
          request.userId,
          {
            enrollmentId: request.body.enrollmentId,
            authenticatorCode: request.body.authenticatorCode,
          },
          app.clock,
        ),
      );

      if (!result.ok) {
        if (result.reason === 'user_not_found') {
          return reply.status(404).send({ error: 'Not found' });
        }
        return reply.status(400).send({ error: 'Invalid or expired enrollment' });
      }

      return reply.status(200).send({ message: 'Authenticator rotated' });
    },
  );
}
