import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { CompleteRegistrationRequestSchema } from '@blindpass/api-schema';
import * as session from '../../auth/session/index.js';
import { completeRegistration } from '../../auth/registration/service.js';
import { authRateLimit } from './rate-limit.js';

export function registerCompleteRegistrationRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/auth/register/complete',
    {
      schema: { body: CompleteRegistrationRequestSchema },
      config: { rateLimit: authRateLimit(10) },
    },
    async (request, reply) => {
      const result = await app.db.transaction(async (tx) =>
        completeRegistration(tx, {
          username: request.body.username,
          enrollmentId: request.body.enrollmentId,
          authenticatorCode: request.body.authenticatorCode,
          userAgent: request.headers['user-agent'],
        }),
      );

      if (!result.ok) {
        const status = result.reason === 'not_provisioned' ? 400 : 400;
        const error =
          result.reason === 'not_provisioned'
            ? 'Account not fully provisioned'
            : 'Invalid or expired enrollment';
        return reply.status(status).send({ error });
      }

      session.attachCookie(reply, result.proof);
      return reply.status(200).send(result.bundle);
    },
  );
}
