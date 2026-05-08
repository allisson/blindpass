import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import Fastify from 'fastify';
import { errorHandler } from '../error-handler.js';
import { QuotaExceededError } from '../vaults/quota.js';

function buildApp() {
  const app = Fastify({ logger: false });
  app.setErrorHandler(errorHandler);
  return app;
}

describe('errorHandler branch coverage', () => {
  it('maps ZodError → 400 validation_error', async () => {
    const app = buildApp();
    app.get('/zod', async () => {
      // Parse intentionally bad input to get a real ZodError
      z.string().min(100).parse('short');
    });
    const res = await app.inject({ method: 'GET', url: '/zod' });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'validation_error' });
    expect(Array.isArray(res.json().issues)).toBe(true);
  });

  it('maps Postgres 23505 → 409 Conflict', async () => {
    const app = buildApp();
    app.get('/pg-conflict', async () => {
      const err = Object.assign(new Error('unique violation'), { code: '23505' });
      throw err;
    });
    const res = await app.inject({ method: 'GET', url: '/pg-conflict' });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'Conflict' });
  });

  it('maps QuotaExceededError → 403 with code, limit, current', async () => {
    const app = buildApp();
    app.get('/quota-vault', async () => {
      throw new QuotaExceededError({
        code: 'vault_limit_reached',
        limit: 10,
        current: 10,
      });
    });
    const res = await app.inject({ method: 'GET', url: '/quota-vault' });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({
      error: 'vault_limit_reached',
      limit: 10,
      current: 10,
    });
  });

  it('maps QuotaExceededError with requested → 403 including requested', async () => {
    const app = buildApp();
    app.get('/quota-batch', async () => {
      throw new QuotaExceededError({
        code: 'item_limit_reached',
        limit: 1000,
        current: 980,
        requested: 50,
      });
    });
    const res = await app.inject({ method: 'GET', url: '/quota-batch' });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({
      error: 'item_limit_reached',
      limit: 1000,
      current: 980,
      requested: 50,
    });
  });

  it('passes through FastifyError.statusCode < 500', async () => {
    const app = buildApp();
    app.get('/fastify-err', async () => {
      // Fastify creates errors with statusCode when routes are not found,
      // but we can simulate with a duck-typed FastifyError
      const err = Object.assign(new Error('Resource not found'), { statusCode: 422 });
      throw err;
    });
    const res = await app.inject({ method: 'GET', url: '/fastify-err' });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ error: 'Resource not found' });
  });
});
