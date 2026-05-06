import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { eq } from 'drizzle-orm';
import { DeleteAccountRequestSchema } from '@blindpass/api-schema';
import { projectSettings, users } from '../../db/schema.js';
import { verifyAuthenticatorForUser } from './verify-authenticator-for-user.js';

export function registerDeleteAccountRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().delete(
    '/user',
    {
      schema: { body: DeleteAccountRequestSchema },
      config: { rateLimit: { max: 3, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      const counter = await verifyAuthenticatorForUser(
        app.db,
        request.userId,
        request.body.authenticatorCode,
      );
      if (counter == null) {
        return reply.status(400).send({ error: 'Invalid authenticator code' });
      }

      let adminProtected = false;
      await app.db.transaction(async (tx) => {
        const [settings] = await tx.select().from(projectSettings).where(eq(projectSettings.id, 1));
        if (settings?.adminUserId === request.userId) {
          adminProtected = true;
          return;
        }
        await tx
          .update(users)
          .set({ totpLastUsedCounter: counter, updatedAt: new Date() })
          .where(eq(users.id, request.userId));
        await tx.delete(users).where(eq(users.id, request.userId));
      });

      if (adminProtected) {
        return reply.status(403).send({ error: 'admin_user_protected' });
      }

      return reply.status(200).send({ message: 'Account deleted' });
    },
  );
}
