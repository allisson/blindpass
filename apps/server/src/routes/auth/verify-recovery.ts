import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { VerifyRecoveryRequestSchema } from '@blindpass/api-schema';
import { verifyRecovery } from '../../auth/recovery/service.js';
import { authRateLimit } from './rate-limit.js';

export function registerVerifyRecoveryRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/auth/recovery/verify',
    {
      schema: { body: VerifyRecoveryRequestSchema },
      config: { rateLimit: authRateLimit(5) },
    },
    async (request, reply) => {
      const result = await app.db.transaction(async (tx) =>
        verifyRecovery(tx, {
          username: request.body.username,
          recoveryVerifier: request.body.recoveryVerifier,
        }),
      );

      if (!result.ok) {
        return reply.status(400).send({ error: 'Invalid recovery credentials' });
      }

      return reply.status(200).send({
        recoveryToken: result.recoveryToken,
        enrollment: result.enrollment,
        bundle: result.bundle,
      });
    },
  );
}
