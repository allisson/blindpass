import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { eq } from 'drizzle-orm';
import { StartLoginRequestSchema, StartLoginResponseSchema } from '@blindpass/api-schema';
import { projectSettings, users } from '../../db/schema.js';
import { isUserStaleUnverified } from './helpers.js';
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
      const [user] = await app.db
        .select({ id: users.id, verified: users.verified, createdAt: users.createdAt })
        .from(users)
        .where(eq(users.username, request.body.username))
        .limit(1);

      if (user && isUserStaleUnverified(user)) {
        await app.db.transaction(async (tx) => {
          const [settings] = await tx
            .select()
            .from(projectSettings)
            .where(eq(projectSettings.id, 1));
          if (settings?.adminUserId === user.id) {
            await tx.delete(projectSettings).where(eq(projectSettings.id, 1));
          }
          await tx.delete(users).where(eq(users.id, user.id));
        });
      }

      return reply.status(200).send({
        message: 'If the account exists, continue with your authenticator code.',
      });
    },
  );
}
