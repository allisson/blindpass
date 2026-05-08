import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { LookupByUsernameQuerySchema } from '@blindpass/api-schema';
import { toB64 } from '../../utils/base64.js';
import { findVerifiedByUsername } from '../../auth/users/repository.js';

export function registerLookupByUsernameRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/users/by-username',
    {
      schema: { querystring: LookupByUsernameQuerySchema },
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '1 hour',
          hook: 'preHandler',
          keyGenerator: (req) => `user:${req.userId ?? req.ip}`,
        },
      },
    },
    async (request, reply) => {
      const user = await findVerifiedByUsername(app.db, request.query.username);
      if (!user?.publicKey) {
        return reply.status(404).send({ error: 'Not found' });
      }
      return reply.status(200).send({ userId: user.id, publicKey: toB64(user.publicKey) });
    },
  );
}
