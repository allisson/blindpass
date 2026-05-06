import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, asc, eq, gt, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  AdminSettingsResponseSchema,
  AdminStatusResponseSchema,
  AdminUsersQuerySchema,
  ListAdminUsersResponseSchema,
  UpdateAdminSettingsRequestSchema,
  UpdateAdminUserRequestSchema,
} from '@blindpass/api-schema';
import { projectSettings, sessions, users } from '../../db/schema.js';

const UserIdParamSchema = z.object({ userId: z.uuid() });

type SettingsRow = typeof projectSettings.$inferSelect;
type AdminCursor = { username: string; id: string };

function encodeCursor(cursor: AdminCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

function decodeCursor(cursor: string | undefined): AdminCursor | undefined {
  if (!cursor) return undefined;
  const parsed = z
    .object({ username: z.string(), id: z.uuid() })
    .safeParse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')));
  if (!parsed.success) throw new Error('invalid_cursor');
  return parsed.data;
}

async function requireAdmin(
  app: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<SettingsRow | undefined> {
  const [settings] = await app.db.select().from(projectSettings).where(eq(projectSettings.id, 1));
  if (!settings || settings.adminUserId !== request.userId) {
    await reply.status(403).send({ error: 'Forbidden' });
    return undefined;
  }
  return settings;
}

function settingsResponse(settings: SettingsRow) {
  return {
    adminUserId: settings.adminUserId,
    registrationsEnabled: settings.registrationsEnabled,
    defaultOwnerQuota: settings.defaultOwnerQuota,
    defaultVaultItemQuota: settings.defaultVaultItemQuota,
  };
}

export function registerAdminRoutes(app: FastifyInstance): void {
  app
    .withTypeProvider<ZodTypeProvider>()
    .get(
      '/admin/status',
      { schema: { response: { 200: AdminStatusResponseSchema } } },
      async (request, reply) => {
        const [settings] = await app.db
          .select()
          .from(projectSettings)
          .where(eq(projectSettings.id, 1));
        return reply.send({ isAdmin: settings?.adminUserId === request.userId });
      },
    );

  app.withTypeProvider<ZodTypeProvider>().get(
    '/admin/settings',
    {
      schema: { response: { 200: AdminSettingsResponseSchema } },
    },
    async (request, reply) => {
      const settings = await requireAdmin(app, request, reply);
      if (!settings) return;
      return reply.status(200).send({ settings: settingsResponse(settings) });
    },
  );

  app.withTypeProvider<ZodTypeProvider>().patch(
    '/admin/settings',
    {
      schema: {
        body: UpdateAdminSettingsRequestSchema,
        response: { 200: AdminSettingsResponseSchema },
      },
    },
    async (request, reply) => {
      const settings = await requireAdmin(app, request, reply);
      if (!settings) return;

      const [updated] = await app.db
        .update(projectSettings)
        .set({ ...request.body, updatedAt: sql`NOW()` })
        .where(eq(projectSettings.id, 1))
        .returning();

      return reply.status(200).send({ settings: settingsResponse(updated) });
    },
  );

  app.withTypeProvider<ZodTypeProvider>().get(
    '/admin/users',
    {
      schema: {
        querystring: AdminUsersQuerySchema,
        response: { 200: ListAdminUsersResponseSchema, 400: z.object({ error: z.string() }) },
      },
    },
    async (request, reply) => {
      const settings = await requireAdmin(app, request, reply);
      if (!settings) return;

      let cursor: AdminCursor | undefined;
      try {
        cursor = decodeCursor(request.query.cursor);
      } catch {
        return reply.status(400).send({ error: 'invalid_cursor' });
      }

      const rows = await app.db
        .select({
          id: users.id,
          username: users.username,
          verified: users.verified,
          revokedAt: users.revokedAt,
          ownerQuotaOverride: users.ownerQuotaOverride,
          vaultItemQuotaOverride: users.vaultItemQuotaOverride,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(
          cursor
            ? or(
                gt(users.username, cursor.username),
                and(eq(users.username, cursor.username), gt(users.id, cursor.id)),
              )
            : undefined,
        )
        .orderBy(asc(users.username), asc(users.id))
        .limit(request.query.limit + 1);

      const hasMore = rows.length > request.query.limit;
      const page = hasMore ? rows.slice(0, request.query.limit) : rows;
      const last = page.at(-1);

      return reply.status(200).send({
        users: page.map((user) => ({
          ...user,
          revokedAt: user.revokedAt?.toISOString() ?? null,
          createdAt: user.createdAt.toISOString(),
          isAdmin: user.id === settings.adminUserId,
        })),
        nextCursor: hasMore && last ? encodeCursor({ username: last.username, id: last.id }) : null,
      });
    },
  );

  app.withTypeProvider<ZodTypeProvider>().patch(
    '/admin/users/:userId',
    {
      schema: { params: UserIdParamSchema, body: UpdateAdminUserRequestSchema },
    },
    async (request, reply) => {
      const settings = await requireAdmin(app, request, reply);
      if (!settings) return;
      const { userId } = request.params;

      if (userId === settings.adminUserId && request.body.revoked === true) {
        return reply.status(403).send({ error: 'admin_user_protected' });
      }

      await app.db.transaction(async (tx) => {
        const update: Partial<typeof users.$inferInsert> = { updatedAt: sql`NOW()` as never };
        if ('revoked' in request.body) {
          update.revokedAt = request.body.revoked ? (sql`NOW()` as never) : null;
        }
        if ('ownerQuotaOverride' in request.body) {
          update.ownerQuotaOverride = request.body.ownerQuotaOverride;
        }
        if ('vaultItemQuotaOverride' in request.body) {
          update.vaultItemQuotaOverride = request.body.vaultItemQuotaOverride;
        }

        await tx.update(users).set(update).where(eq(users.id, userId));
        if (request.body.revoked === true) {
          await tx.delete(sessions).where(eq(sessions.userId, userId));
        }
      });

      return reply.status(204).send();
    },
  );

  app.withTypeProvider<ZodTypeProvider>().delete(
    '/admin/users/:userId',
    {
      schema: { params: UserIdParamSchema },
    },
    async (request, reply) => {
      const settings = await requireAdmin(app, request, reply);
      if (!settings) return;
      const { userId } = request.params;
      if (userId === settings.adminUserId) {
        return reply.status(403).send({ error: 'admin_user_protected' });
      }

      await app.db.delete(users).where(eq(users.id, userId));
      return reply.status(204).send();
    },
  );
}
