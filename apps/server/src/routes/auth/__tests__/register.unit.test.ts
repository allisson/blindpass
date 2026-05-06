import { describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { registerRegisterRoute } from '../register.js';

function makeChain(result: unknown) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain['from'] = vi.fn().mockReturnValue(chain);
  chain['where'] = vi.fn().mockReturnValue(chain);
  chain['limit'] = vi.fn().mockResolvedValue(result);
  chain['returning'] = vi.fn().mockResolvedValue(result);
  chain['values'] = vi.fn().mockReturnValue(chain);
  chain['set'] = vi.fn().mockReturnValue(chain);
  chain['then'] = vi.fn((resolve, reject) => Promise.resolve(result).then(resolve, reject));
  return chain;
}

function createMockDb() {
  return {
    select: vi.fn(() => makeChain([])),
    insert: vi.fn(() => makeChain([])),
    update: vi.fn(() => makeChain([])),
    delete: vi.fn(() => makeChain([])),
    transaction: vi.fn(async (cb: (tx: Record<string, unknown>) => Promise<unknown>) =>
      cb({
        execute: vi.fn().mockResolvedValue(undefined),
        select: vi.fn(() => makeChain([])),
        insert: vi
          .fn()
          .mockReturnValueOnce(makeChain([{ id: 'new-user-id' }]))
          .mockReturnValueOnce(makeChain([]))
          .mockReturnValueOnce(makeChain([]))
          .mockReturnValueOnce(makeChain([{ id: 'enrollment-id' }])),
        delete: vi.fn(() => makeChain([])),
      }),
    ),
  };
}

function buildApp(dbOverrides?: Partial<ReturnType<typeof createMockDb>>) {
  const mockDb = { ...createMockDb(), ...dbOverrides };
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.decorate('db', mockDb as any);
  registerRegisterRoute(app);
  return { app, mockDb };
}

const validBody = {
  username: 'test_user',
  kekSalt: Buffer.from('salt').toString('base64'),
  publicKey: Buffer.from('pubkey').toString('base64'),
  encryptedMasterKey: {
    ciphertext: Buffer.from('c').toString('base64'),
    nonce: Buffer.from('n').toString('base64'),
  },
  encryptedMasterKeyForRecovery: {
    ciphertext: Buffer.from('c').toString('base64'),
    nonce: Buffer.from('n').toString('base64'),
  },
  encryptedPrivateKey: {
    ciphertext: Buffer.from('c').toString('base64'),
    nonce: Buffer.from('n').toString('base64'),
  },
  encryptedRecoveryKey: {
    ciphertext: Buffer.from('c').toString('base64'),
    nonce: Buffer.from('n').toString('base64'),
  },
  encryptedVaultKey: {
    ciphertext: Buffer.from('c').toString('base64'),
    nonce: Buffer.from('n').toString('base64'),
  },
  encryptedVaultData: {
    ciphertext: Buffer.from('c').toString('base64'),
    nonce: Buffer.from('n').toString('base64'),
  },
  recoveryVerifier: Buffer.from('recovery phrase').toString('base64'),
};

describe('POST /auth/register', () => {
  it('returns 400 on invalid body', async () => {
    const { app } = buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      body: { username: 'BAD!' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 409 when username already exists', async () => {
    const mockDb = createMockDb();
    const pgError = Object.assign(new Error('unique violation'), { code: '23505' });
    mockDb.transaction.mockRejectedValueOnce(pgError);
    const { app } = buildApp(mockDb);

    const res = await app.inject({ method: 'POST', url: '/auth/register', body: validBody });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ error: 'Conflict' });
  });

  it('returns enrollment payload on success', async () => {
    const { app } = buildApp();
    const res = await app.inject({ method: 'POST', url: '/auth/register', body: validBody });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      enrollment: {
        enrollmentId: 'enrollment-id',
        setupKey: expect.any(String),
        otpauthUri: expect.any(String),
        expiresAt: expect.any(String),
      },
    });
  });
});
