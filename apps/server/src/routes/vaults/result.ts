import type { FastifyReply } from 'fastify';

type StatusEntry = [status: number, message: string];

const DEFAULTS: Record<string, StatusEntry> = {
  vault_not_found: [404, 'Vault not found'],
  forbidden: [403, 'Forbidden'],
};

/**
 * Sends an error reply for a vault ServiceResult failure. Call inside an
 * `if (!result.ok)` guard so TypeScript can narrow the success branch:
 *
 *   if (!result.ok) return sendVaultFailure(reply, result.reason, { ... });
 *
 * AccessFailure reasons are handled by default:
 *   vault_not_found → 404, forbidden → 403
 *
 * Pass `extra` to map domain-specific reasons (e.g. item_not_found, last_vault).
 * Extra entries override the defaults, so they can also remap canonical reasons.
 */
export function sendVaultFailure(
  reply: FastifyReply,
  reason: string | undefined,
  extra: Record<string, StatusEntry> = {},
): FastifyReply {
  const map = { ...DEFAULTS, ...extra };
  const entry = reason !== undefined ? map[reason] : undefined;
  const [status, error] = entry ?? [500, 'Internal server error'];
  return reply.status(status).send({ error });
}
