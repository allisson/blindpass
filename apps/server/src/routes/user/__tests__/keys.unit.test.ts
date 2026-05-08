import { describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { registerUserKeysRoute, USER_KEYS_GET_RATE_LIMIT_MAX } from '../keys.js';

function makeChain(result: unknown) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain['from'] = vi.fn().mockReturnValue(chain);
  chain['where'] = vi.fn().mockReturnValue(chain);
  chain['limit'] = vi.fn().mockResolvedValue(result);
  chain['returning'] = vi.fn().mockResolvedValue(result);
  chain['values'] = vi.fn().mockReturnValue(chain);
  chain['set'] = vi.fn().mockReturnValue(chain);
  return chain;
}

const TEST_USER_ID = 'test-user-id';

function buildApp(selectResult: unknown[]) {
  const mockDb = {
    select: vi.fn(() => makeChain(selectResult)),
    update: vi.fn(() => makeChain([])),
  };
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.decorate('db', mockDb as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.decorate('mailer', {} as any);
  app.addHook('preHandler', async (request) => {
    request.userId = TEST_USER_ID;
  });
  registerUserKeysRoute(app);
  return { app, mockDb };
}

const keyBlob = Buffer.from('test').toString('base64');
const encVal = { ciphertext: keyBlob, nonce: keyBlob };
const validBody = {
  kekSalt: keyBlob,
  publicKey: keyBlob,
  encryptedMasterKey: encVal,
  encryptedMasterKeyForRecovery: encVal,
  encryptedPrivateKey: encVal,
  encryptedRecoveryKey: encVal,
};

const mockUser = {
  id: TEST_USER_ID,
  kekSalt: Buffer.from('salt'),
  publicKey: Buffer.from('pub'),
  encryptedMasterKeyCiphertext: Buffer.from('mc'),
  encryptedMasterKeyNonce: Buffer.from('mn'),
  encryptedMasterKeyForRecoveryCiphertext: Buffer.from('mrc'),
  encryptedMasterKeyForRecoveryNonce: Buffer.from('mrn'),
  encryptedPrivateKeyCiphertext: Buffer.from('pc'),
  encryptedPrivateKeyNonce: Buffer.from('pn'),
  encryptedRecoveryKeyCiphertext: Buffer.from('rc'),
  encryptedRecoveryKeyNonce: Buffer.from('rn'),
};

describe('GET /user/keys', () => {
  it('returns 404 when user has no keys', async () => {
    const { app } = buildApp([]);
    const res = await app.inject({ method: 'GET', url: '/user/keys' });
    expect(res.statusCode).toBe(404);
  });

  it('returns 200 with base64-encoded key blobs', async () => {
    const { app } = buildApp([mockUser]);
    const res = await app.inject({ method: 'GET', url: '/user/keys' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('kekSalt');
    expect(body).toHaveProperty('encryptedMasterKey.ciphertext');
    expect(body).toHaveProperty('encryptedMasterKey.nonce');
  });
});

describe('PUT /user/keys', () => {
  it('returns 400 on invalid body', async () => {
    const { app } = buildApp([]);
    const res = await app.inject({ method: 'PUT', url: '/user/keys', body: {} });
    expect(res.statusCode).toBe(400);
  });

  it('returns 200 on valid update', async () => {
    const { app } = buildApp([]);
    const res = await app.inject({ method: 'PUT', url: '/user/keys', body: validBody });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ message: 'Keys updated' });
  });
});

describe('rate limiting', () => {
  it('returns 429 when GET /user/keys exceeds route rate limit', async () => {
    const mockDb = {
      select: vi.fn(() => makeChain([mockUser])),
      update: vi.fn(() => makeChain([])),
    };
    const app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    await app.register(rateLimit, { global: true, max: 1000, timeWindow: '1 minute' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    app.decorate('db', mockDb as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    app.decorate('mailer', {} as any);
    app.addHook('preHandler', async (request) => {
      request.userId = TEST_USER_ID;
    });
    registerUserKeysRoute(app);
    await app.ready();

    // GET /user/keys has a route-specific cap — exhaust it, then confirm 429.
    for (let i = 0; i < USER_KEYS_GET_RATE_LIMIT_MAX; i++) {
      await app.inject({ method: 'GET', url: '/user/keys' });
    }
    const res = await app.inject({ method: 'GET', url: '/user/keys' });
    expect(res.statusCode).toBe(429);
  });
});
