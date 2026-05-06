import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { eq } from 'drizzle-orm';
import { CompleteLoginRequestSchema } from '@blindpass/api-schema';
import { sessions, users } from '../../db/schema.js';
import { insertSessionValues, issueSessionToken, setAuthCookie } from './helpers.js';
import { verifyAuthenticatorForUser } from '../user/verify-authenticator-for-user.js';
import { authRateLimit } from './rate-limit.js';

export function registerCompleteLoginRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/auth/login/complete',
    {
      schema: { body: CompleteLoginRequestSchema },
      config: { rateLimit: authRateLimit(10) },
    },
    async (request, reply) => {
      const [user] = await app.db
        .select({ id: users.id, verified: users.verified, revokedAt: users.revokedAt })
        .from(users)
        .where(eq(users.username, request.body.username))
        .limit(1);

      if (!user || !user.verified || user.revokedAt) {
        return reply.status(400).send({ error: 'Invalid credentials' });
      }

      const counter = await verifyAuthenticatorForUser(
        app.db,
        user.id,
        request.body.authenticatorCode,
      );
      if (counter == null) {
        return reply.status(400).send({ error: 'Invalid credentials' });
      }

      const authToken = issueSessionToken();
      await app.db.transaction(async (tx) => {
        await tx
          .update(users)
          .set({ totpLastUsedCounter: counter, updatedAt: new Date() })
          .where(eq(users.id, user.id));
        await tx
          .insert(sessions)
          .values(insertSessionValues(user.id, authToken, request.headers['user-agent']));
      });

      setAuthCookie(reply, authToken);
      return reply.status(200).send({ message: 'Authenticated' });
    },
  );
}
