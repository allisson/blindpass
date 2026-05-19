import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  BiometricCredentialSchema,
  ListBiometricCredentialsResponseSchema,
  RegisterBiometricCredentialRequestSchema,
  RegisterBiometricCredentialResponseSchema,
} from '@blindpass/api-schema';
import { b64 } from '../../utils/base64.js';
import * as repo from '../../auth/biometric-credentials/repository.js';

export function registerBiometricCredentialsRoutes(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/auth/biometric-credentials',
    {
      schema: {
        body: RegisterBiometricCredentialRequestSchema,
        response: {
          201: RegisterBiometricCredentialResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { credentialId: credentialIdB64, label } = request.body;
      const credentialIdBuf = b64(credentialIdB64);
      const row = await repo.register(app.db, request.userId, credentialIdBuf, label);
      return reply.status(201).send({
        id: row.id,
        createdAt: row.createdAt.toISOString(),
      });
    },
  );

  app.withTypeProvider<ZodTypeProvider>().get(
    '/auth/biometric-credentials',
    {
      schema: {
        response: {
          200: ListBiometricCredentialsResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const rows = await repo.listForUser(app.db, request.userId);
      return reply.status(200).send({
        credentials: rows.map((r) => ({
          id: r.id,
          label: r.label ?? null,
          createdAt: r.createdAt.toISOString(),
          lastSeenAt: r.lastSeenAt.toISOString(),
        })),
      });
    },
  );

  app.withTypeProvider<ZodTypeProvider>().get(
    '/auth/biometric-credentials/:id',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        response: {
          200: BiometricCredentialSchema,
          404: z.object({
            error: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const row = await repo.findByIdForUser(app.db, request.params.id, request.userId);
      if (!row) return reply.status(404).send({ error: 'Not found' });
      void repo.touchLastSeen(app.db, row.id).catch((err) => {
        app.log.debug({ err }, 'touchLastSeen failed');
      });
      return reply.status(200).send({
        id: row.id,
        label: row.label ?? null,
        createdAt: row.createdAt.toISOString(),
        lastSeenAt: row.lastSeenAt.toISOString(),
      });
    },
  );

  app.withTypeProvider<ZodTypeProvider>().delete(
    '/auth/biometric-credentials/:id',
    {
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        response: {
          204: z.void(),
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const deleted = await repo.deleteByIdForUser(app.db, request.params.id, request.userId);
      if (!deleted) return reply.status(404).send({ error: 'Not found' });
      return reply.status(204).send();
    },
  );
}
