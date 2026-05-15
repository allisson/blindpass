import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { StartTotpRotationRequestSchema } from '@blindpass/api-schema';
import { startRotation } from '../../auth/totp-rotation/service.js';
import { asTx } from '../../db/tx.js';

export function registerStartTotpRotationRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/user/totp/rotate/start',
    {
      schema: { body: StartTotpRotationRequestSchema },
      config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      const result = await app.db.transaction(async (tx) =>
        startRotation(
          asTx(tx),
          request.userId,
          {
            authenticatorCode: request.body.authenticatorCode,
          },
          app.clock,
        ),
      );

      if (!result.ok) {
        if (result.reason === 'user_not_found') {
          return reply.status(404).send({ error: 'Not found' });
        }
        return reply.status(400).send({ error: 'Invalid authenticator code' });
      }

      return reply.status(200).send({ enrollment: result.enrollment });
    },
  );
}
