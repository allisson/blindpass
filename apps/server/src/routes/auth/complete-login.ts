import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { CompleteLoginRequestSchema } from '@blindpass/api-schema';
import * as session from '../../auth/session/index.js';
import { completeLogin } from '../../auth/login/service.js';
import { authRateLimit } from './rate-limit.js';

export function registerCompleteLoginRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/auth/login/complete',
    {
      schema: { body: CompleteLoginRequestSchema },
      config: { rateLimit: authRateLimit(10) },
    },
    async (request, reply) => {
      const result = await app.db.transaction(async (tx) =>
        completeLogin(tx, {
          username: request.body.username,
          authenticatorCode: request.body.authenticatorCode,
          userAgent: request.headers['user-agent'],
        }),
      );

      if (!result.ok) {
        return reply.status(400).send({ error: 'Invalid credentials' });
      }

      session.attachCookie(reply, result.proof);
      return reply.status(200).send({ message: 'Authenticated' });
    },
  );
}
