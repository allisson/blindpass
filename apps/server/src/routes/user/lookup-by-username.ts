import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, eq } from 'drizzle-orm';
import { LookupByUsernameQuerySchema } from '@blindpass/api-schema';
import { users } from '../../db/schema.js';
import { toB64 } from '../../utils/base64.js';

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
      const [user] = await app.db
        .select({ id: users.id, publicKey: users.publicKey })
        .from(users)
        .where(and(eq(users.username, request.query.username), eq(users.verified, true)))
        .limit(1);

      if (!user?.publicKey) {
        return reply.status(404).send({ error: 'Not found' });
      }

      return reply.status(200).send({ userId: user.id, publicKey: toB64(user.publicKey) });
    },
  );
}
