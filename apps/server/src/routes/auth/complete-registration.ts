import type { FastifyInstance } from 'fastify';
import { CompleteRegistrationRequestSchema } from '@blindpass/api-schema';
import { completeRegistration } from '../../auth/registration/service.js';
import { registerCompleteAuthRoute } from './complete-route.js';

export function registerCompleteRegistrationRoute(app: FastifyInstance): void {
  registerCompleteAuthRoute(app, {
    path: '/auth/register/complete',
    schema: CompleteRegistrationRequestSchema,
    rateLimit: 10,
    run: async (tx, request, clock) => {
      const r = await completeRegistration(
        tx,
        {
          username: request.body.username,
          enrollmentId: request.body.enrollmentId,
          authenticatorCode: request.body.authenticatorCode,
          userAgent: request.headers['user-agent'],
        },
        clock,
      );
      return r.ok ? { ok: true, proof: r.proof, payload: r.bundle } : r;
    },
  });
}
