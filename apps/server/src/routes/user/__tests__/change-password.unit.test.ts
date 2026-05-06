import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

const verifyAuthenticatorForUser = vi.fn();

vi.mock('../verify-authenticator-for-user.js', () => ({
  verifyAuthenticatorForUser,
}));

const USER_ID = 'user-id';

function makeChain(result: unknown) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain['where'] = vi.fn().mockResolvedValue(result);
  chain['set'] = vi.fn().mockReturnValue(chain);
  return chain;
}

async function buildApp(
  txOverride?: (fn: (tx: Record<string, unknown>) => Promise<unknown>) => Promise<unknown>,
) {
  const { registerChangePasswordRoute } = await import('../change-password.js');
  const mockDb = {
    transaction:
      txOverride ??
      vi.fn(async (fn: (tx: Record<string, unknown>) => Promise<unknown>) =>
        fn({
          update: vi.fn(() => makeChain([])),
          delete: vi.fn(() => makeChain([])),
        }),
      ),
  };
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.decorate('db', mockDb as any);
  app.addHook('preHandler', async (request) => {
    request.userId = USER_ID;
    request.sessionId = 'session-id';
  });
  registerChangePasswordRoute(app);
  return { app, mockDb };
}

const validBody = {
  authenticatorCode: '123456',
  kekSalt: Buffer.from('new-salt').toString('base64'),
  encryptedMasterKey: {
    ciphertext: Buffer.from('c').toString('base64'),
    nonce: Buffer.from('n').toString('base64'),
  },
};

beforeEach(() => {
  verifyAuthenticatorForUser.mockReset();
});

describe('PUT /user/password', () => {
  it('returns 400 on invalid body', async () => {
    const { app } = await buildApp();
    const res = await app.inject({ method: 'PUT', url: '/user/password', body: {} });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when authenticator code is invalid', async () => {
    verifyAuthenticatorForUser.mockResolvedValueOnce(null);
    const { app } = await buildApp();
    const res = await app.inject({ method: 'PUT', url: '/user/password', body: validBody });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'Invalid authenticator code' });
  });

  it('returns 200 on valid authenticator code', async () => {
    verifyAuthenticatorForUser.mockResolvedValueOnce(42);
    const { app } = await buildApp();
    const res = await app.inject({ method: 'PUT', url: '/user/password', body: validBody });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ message: 'Password changed' });
  });

  it('returns 500 when transaction throws', async () => {
    verifyAuthenticatorForUser.mockResolvedValueOnce(42);
    const { app } = await buildApp(async () => {
      throw new Error('transaction failed');
    });
    const res = await app.inject({ method: 'PUT', url: '/user/password', body: validBody });
    expect(res.statusCode).toBe(500);
  });
});
