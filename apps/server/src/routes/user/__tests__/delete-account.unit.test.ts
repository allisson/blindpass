import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

const verifyAuthenticatorForUser = vi.fn();

vi.mock('../../../auth/totp/verify-for-user.js', () => ({
  verifyAuthenticatorForUser,
}));

const USER_ID = 'user-id';

function makeChain(result: unknown) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain['from'] = vi.fn().mockReturnValue(chain);
  chain['where'] = vi.fn().mockResolvedValue(result);
  chain['set'] = vi.fn().mockReturnValue(chain);
  chain['limit'] = vi.fn().mockResolvedValue(result);
  return chain;
}

async function buildApp(options?: {
  adminUserId?: string | null;
  txOverride?: (fn: (tx: Record<string, unknown>) => Promise<unknown>) => Promise<unknown>;
}) {
  const { registerDeleteAccountRoute } = await import('../delete-account.js');
  const txOverride = options?.txOverride;
  const adminUserId = options?.adminUserId ?? null;
  const mockDb = {
    transaction:
      txOverride ??
      vi.fn(async (fn: (tx: Record<string, unknown>) => Promise<unknown>) =>
        fn({
          select: vi.fn(() =>
            makeChain(adminUserId ? [{ id: 1, adminUserId }] : [{ id: 1, adminUserId: null }]),
          ),
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
  registerDeleteAccountRoute(app);
  return { app, mockDb };
}

beforeEach(() => {
  verifyAuthenticatorForUser.mockReset();
});

describe('DELETE /user', () => {
  it('returns 400 on invalid body', async () => {
    const { app } = await buildApp();
    const res = await app.inject({ method: 'DELETE', url: '/user', body: {} });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when authenticator code is invalid', async () => {
    verifyAuthenticatorForUser.mockResolvedValueOnce(null);
    const { app } = await buildApp();
    const res = await app.inject({
      method: 'DELETE',
      url: '/user',
      body: { authenticatorCode: '123456' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'Invalid authenticator code' });
  });

  it('returns 403 for the admin user', async () => {
    verifyAuthenticatorForUser.mockResolvedValueOnce(42);
    const { app } = await buildApp({ adminUserId: USER_ID });
    const res = await app.inject({
      method: 'DELETE',
      url: '/user',
      body: { authenticatorCode: '123456' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ error: 'admin_user_protected' });
  });

  it('returns 200 and deletes account on valid authenticator code', async () => {
    verifyAuthenticatorForUser.mockResolvedValueOnce(42);
    const { app } = await buildApp();
    const res = await app.inject({
      method: 'DELETE',
      url: '/user',
      body: { authenticatorCode: '123456' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ message: 'Account deleted' });
  });
});
