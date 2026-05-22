import type { FastifyInstance } from 'fastify';
import { CompleteLoginRequestSchema } from '@blindpass/api-schema';
import { completeLogin } from '../../auth/login/service.js';
import { registerCompleteAuthRoute } from './complete-route.js';

export function registerCompleteLoginRoute(app: FastifyInstance): void {
  registerCompleteAuthRoute(app, {
    path: '/auth/login/complete',
    schema: CompleteLoginRequestSchema,
    rateLimit: 10,
    run: async (tx, request, clock) => {
      const r = await completeLogin(
        tx,
        {
          username: request.body.username,
          authenticatorCode: request.body.authenticatorCode,
          userAgent: request.headers['user-agent'],
        },
        clock,
      );
      return r.ok ? { ok: true, proof: r.proof, payload: { message: 'Authenticated' } } : r;
    },
  });
}
