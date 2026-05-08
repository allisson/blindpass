import { ZodError } from 'zod';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { QuotaExceededError } from './vaults/quota.js';

const PG_UNIQUE_VIOLATION = '23505';

// Network/external-service error codes that warrant a 503 response.
// Includes ioredis AbortError (thrown when enableOfflineQueue=false and Redis is offline).
const EXTERNAL_SERVICE_CODES = new Set(['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'EHOSTUNREACH']);

function isExternalServiceError(error: FastifyError & { code?: string }): boolean {
  const code = (error as NodeJS.ErrnoException).code;
  const causeCode = (error as { cause?: NodeJS.ErrnoException }).cause?.code;
  return (
    EXTERNAL_SERVICE_CODES.has(code ?? '') ||
    EXTERNAL_SERVICE_CODES.has(causeCode ?? '') ||
    error.name === 'AbortError'
  );
}

export function errorHandler(
  error: FastifyError & { code?: string },
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (error instanceof QuotaExceededError) {
    const body: { error: string; limit: number; current: number; requested?: number } = {
      error: error.code,
      limit: error.limit,
      current: error.current,
    };
    if (error.requested !== undefined) body.requested = error.requested;
    return reply.status(403).send(body);
  }
  if (error instanceof ZodError) {
    return reply.status(400).send({ error: 'validation_error', issues: error.issues });
  }
  if (hasZodFastifySchemaValidationErrors(error)) {
    return reply.status(400).send({ error: 'invalid_params' });
  }
  const pgCode = error.code ?? (error as unknown as { cause?: { code?: string } }).cause?.code;
  if (pgCode === PG_UNIQUE_VIOLATION) {
    return reply.status(409).send({ error: 'Conflict' });
  }
  if (typeof error.statusCode === 'number' && error.statusCode < 500) {
    return reply.status(error.statusCode).send({ error: error.message });
  }
  if (isExternalServiceError(error)) {
    request.log.error({ err: error }, 'External service unavailable');
    return reply.status(503).send({ error: 'service_unavailable' });
  }
  request.log.error({ err: error }, 'Unhandled error');
  return reply.status(500).send({ error: 'internal_error' });
}
