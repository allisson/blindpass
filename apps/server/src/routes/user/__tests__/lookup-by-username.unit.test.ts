import { describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { registerLookupByUsernameRoute } from '../lookup-by-username.js';

const CALLER_ID = 'caller-user-id';

function makeChain(result: unknown) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain['from'] = vi.fn().mockReturnValue(chain);
  chain['where'] = vi.fn().mockReturnValue(chain);
  chain['limit'] = vi.fn().mockResolvedValue(result);
  return chain;
}

function buildApp(selectResult: unknown[]) {
  const mockDb = {
    select: vi.fn(() => makeChain(selectResult)),
  };
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.decorate('db', mockDb as any);
  app.addHook('preHandler', async (request) => {
    request.userId = CALLER_ID;
  });
  registerLookupByUsernameRoute(app);
  return { app };
}

describe('GET /users/by-username', () => {
  it('returns 400 for invalid username', async () => {
    const { app } = buildApp([]);
    const res = await app.inject({ method: 'GET', url: '/users/by-username?username=BAD!' });
    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when user is not found', async () => {
    const { app } = buildApp([]);
    const res = await app.inject({ method: 'GET', url: '/users/by-username?username=ghost_user' });
    expect(res.statusCode).toBe(404);
  });

  it('returns 200 with user id and public key', async () => {
    const { app } = buildApp([{ id: 'receiver-id', publicKey: Buffer.from('pub') }]);
    const res = await app.inject({
      method: 'GET',
      url: '/users/by-username?username=receiver_user',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      userId: 'receiver-id',
      publicKey: Buffer.from('pub').toString('base64'),
    });
  });
});
