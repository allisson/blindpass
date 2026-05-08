import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { StartLoginRequestSchema, StartLoginResponseSchema } from '@blindpass/api-schema';
import { findStalenessProbeByUsername } from '../../auth/users/repository.js';
import { gcStaleUnverified, isUserStaleUnverified } from '../../auth/users/staleness.js';
import { authRateLimit } from './rate-limit.js';

export function registerStartLoginRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/auth/login/start',
    {
      schema: {
        body: StartLoginRequestSchema,
        response: { 200: StartLoginResponseSchema },
      },
      config: { rateLimit: authRateLimit(20) },
    },
    async (request, reply) => {
      const user = await findStalenessProbeByUsername(app.db, request.body.username);
      if (user && isUserStaleUnverified(user)) {
        await app.db.transaction((tx) => gcStaleUnverified(tx, user.id));
      }
      return reply.status(200).send({
        message: 'If the account exists, continue with your authenticator code.',
      });
    },
  );
}
