import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { z, ZodType } from 'zod';
import * as session from '../../auth/session/index.js';
import type { ProofOfSession } from '../../auth/session/index.js';
import { asTx, type TxDb } from '../../db/tx.js';
import type { Clock } from '../../plugins/clock.js';
import { authRateLimit } from './rate-limit.js';
import { sendAuthFailure, type AuthFailureReason } from './result.js';

export type CompleteAuthOutcome<P> =
  | { ok: true; proof: ProofOfSession; payload: P }
  | { ok: false; reason: AuthFailureReason };

export interface CompleteAuthRouteConfig<Schema extends ZodType, Payload> {
  path: string;
  schema: Schema;
  rateLimit: number;
  run: (
    tx: TxDb,
    request: FastifyRequest<{ Body: z.infer<Schema> }>,
    clock: Clock,
  ) => Promise<CompleteAuthOutcome<Payload>>;
}

// The shared shape of an auth ceremony route that ends in a SessionIssuance:
// own the transaction, sendAuthFailure mapping, ProofOfSession consumption,
// and 200 reply. The cookie attach is non-optional — it is what defines this
// seam. Routes that don't issue a session are not CompleteAuthRoutes.
export function registerCompleteAuthRoute<S extends ZodType, P>(
  app: FastifyInstance,
  cfg: CompleteAuthRouteConfig<S, P>,
): void {
  app.withTypeProvider<ZodTypeProvider>().post(
    cfg.path,
    {
      schema: { body: cfg.schema },
      config: { rateLimit: authRateLimit(cfg.rateLimit) },
    },
    async (request, reply) => {
      const result = await app.db.transaction((tx) =>
        cfg.run(asTx(tx), request as FastifyRequest<{ Body: z.infer<S> }>, app.clock),
      );

      if (!result.ok) return sendAuthFailure(reply, result.reason);

      session.attachCookie(reply, result.proof);
      return reply.status(200).send(result.payload);
    },
  );
}
