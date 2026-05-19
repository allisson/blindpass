import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { registerBiometricCredentialsRoutes } from '../biometric-credentials.js';

const { mockRegister, mockList, mockFind, mockDelete, mockTouch } = vi.hoisted(() => ({
  mockRegister: vi.fn(),
  mockList: vi.fn(),
  mockFind: vi.fn(),
  mockDelete: vi.fn(),
  mockTouch: vi.fn(),
}));

vi.mock('../../../auth/biometric-credentials/repository.js', () => ({
  register: mockRegister,
  listForUser: mockList,
  findByIdForUser: mockFind,
  deleteByIdForUser: mockDelete,
  touchLastSeen: mockTouch,
}));

const CALLER_ID = 'caller-user-id';
const CRED_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const CRED_B64 = Buffer.from('test-credential-bytes').toString('base64');
const NOW = new Date('2024-06-01T12:00:00.000Z');

function buildApp() {
  const app = Fastify();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.decorate('db', {} as any);
  app.addHook('preHandler', async (request) => {
    request.userId = CALLER_ID;
  });
  registerBiometricCredentialsRoutes(app);
  return { app };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTouch.mockResolvedValue(undefined);
});

describe('POST /auth/biometric-credentials', () => {
  it('returns 201 with id and createdAt', async () => {
    mockRegister.mockResolvedValue({ id: CRED_UUID, createdAt: NOW });
    const { app } = buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/biometric-credentials',
      body: { credentialId: CRED_B64, label: 'My Touch ID' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ id: CRED_UUID, createdAt: NOW.toISOString() });
    expect(mockRegister).toHaveBeenCalledOnce();
    expect(mockRegister).toHaveBeenCalledWith(
      expect.anything(),
      CALLER_ID,
      expect.any(Buffer),
      'My Touch ID',
    );
  });

  it('registers without label', async () => {
    mockRegister.mockResolvedValue({ id: CRED_UUID, createdAt: NOW });
    const { app } = buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/biometric-credentials',
      body: { credentialId: CRED_B64 },
    });
    expect(res.statusCode).toBe(201);
    expect(mockRegister).toHaveBeenCalledWith(
      expect.anything(),
      CALLER_ID,
      expect.any(Buffer),
      undefined,
    );
  });
});

describe('GET /auth/biometric-credentials', () => {
  it('returns 200 with empty array when no credentials', async () => {
    mockList.mockResolvedValue([]);
    const { app } = buildApp();
    const res = await app.inject({ method: 'GET', url: '/auth/biometric-credentials' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ credentials: [] });
  });

  it('returns 200 with mapped credential list', async () => {
    mockList.mockResolvedValue([
      { id: CRED_UUID, label: 'iPhone', createdAt: NOW, lastSeenAt: NOW },
    ]);
    const { app } = buildApp();
    const res = await app.inject({ method: 'GET', url: '/auth/biometric-credentials' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      credentials: [
        {
          id: CRED_UUID,
          label: 'iPhone',
          createdAt: NOW.toISOString(),
          lastSeenAt: NOW.toISOString(),
        },
      ],
    });
  });

  it('maps null label correctly', async () => {
    mockList.mockResolvedValue([{ id: CRED_UUID, label: null, createdAt: NOW, lastSeenAt: NOW }]);
    const { app } = buildApp();
    const res = await app.inject({ method: 'GET', url: '/auth/biometric-credentials' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ credentials: { label: null }[] }>();
    expect(body.credentials[0].label).toBeNull();
  });
});

describe('GET /auth/biometric-credentials/:id', () => {
  it('returns 200 and fires touchLastSeen on found credential', async () => {
    mockFind.mockResolvedValue({ id: CRED_UUID, label: 'Laptop', createdAt: NOW, lastSeenAt: NOW });
    const { app } = buildApp();
    const res = await app.inject({
      method: 'GET',
      url: `/auth/biometric-credentials/${CRED_UUID}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      id: CRED_UUID,
      label: 'Laptop',
      createdAt: NOW.toISOString(),
      lastSeenAt: NOW.toISOString(),
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(mockTouch).toHaveBeenCalledWith(expect.anything(), CRED_UUID);
  });

  it('returns 404 and does not touch when not found', async () => {
    mockFind.mockResolvedValue(null);
    const { app } = buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/auth/biometric-credentials/nonexistent',
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: 'Not found' });
    expect(mockTouch).not.toHaveBeenCalled();
  });
});

describe('DELETE /auth/biometric-credentials/:id', () => {
  it('returns 204 when credential deleted', async () => {
    mockDelete.mockResolvedValue(true);
    const { app } = buildApp();
    const res = await app.inject({
      method: 'DELETE',
      url: `/auth/biometric-credentials/${CRED_UUID}`,
    });
    expect(res.statusCode).toBe(204);
    expect(mockDelete).toHaveBeenCalledWith(expect.anything(), CRED_UUID, CALLER_ID);
  });

  it('returns 404 when credential not found', async () => {
    mockDelete.mockResolvedValue(false);
    const { app } = buildApp();
    const res = await app.inject({
      method: 'DELETE',
      url: '/auth/biometric-credentials/nonexistent',
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: 'Not found' });
  });
});
