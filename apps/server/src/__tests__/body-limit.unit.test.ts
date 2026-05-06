import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { env } from '../env.js';

describe('body limit', () => {
  it('BODY_LIMIT_BYTES defaults to 512KB', () => {
    expect(env.BODY_LIMIT_BYTES).toBe(512 * 1024);
  });

  it('rejects request body exceeding BODY_LIMIT_BYTES with 413', async () => {
    const app = Fastify({ bodyLimit: env.BODY_LIMIT_BYTES });
    app.post('/test', async (_, reply) => reply.send({ ok: true }));
    await app.ready();

    // JSON string large enough to exceed the limit
    const oversizedJson = JSON.stringify({ data: 'x'.repeat(env.BODY_LIMIT_BYTES + 1) });
    const res = await app.inject({
      method: 'POST',
      url: '/test',
      headers: { 'content-type': 'application/json' },
      payload: oversizedJson,
    });

    expect(res.statusCode).toBe(413);
    await app.close();
  });

  it('accepts request body within BODY_LIMIT_BYTES', async () => {
    const app = Fastify({ bodyLimit: env.BODY_LIMIT_BYTES });
    app.post('/test', async (_, reply) => reply.send({ ok: true }));
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/test',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ ok: true }),
    });

    expect(res.statusCode).toBe(200);
    await app.close();
  });
});
