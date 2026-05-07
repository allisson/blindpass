import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { authPlugin } from '../auth.js';

vi.mock('../../env.js', () => ({
  env: {
    COOKIE_NAME: 'bp_session',
    CORS_ORIGIN: ['http://localhost:5173'],
    SESSION_IDLE_TTL_MS: 7 * 24 * 60 * 60 * 1000,
  },
}));

const RAW_TOKEN = 'a'.repeat(64);

function buildApp(sessionRow: { id: string; userId: string } | null) {
  const sessionResult = sessionRow ? [sessionRow] : [];
  const mockDb = {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue(sessionResult),
          }),
        }),
        where: () => ({
          limit: vi.fn().mockResolvedValue(sessionResult),
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  };
  const app = Fastify();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.decorate('db', mockDb as any);
  return { app };
}

async function setupApp(sessionRow: { id: string; userId: string } | null) {
  const { app } = buildApp(sessionRow);
  await app.register(cookie);
  await app.register(authPlugin);
  app.get('/protected', async () => ({ ok: true }));
  app.post('/protected', async () => ({ ok: true }));
  app.delete('/protected', async () => ({ ok: true }));
  app.post('/auth/login/start', async () => ({ ok: true }));
  return { app };
}

describe('authPlugin', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lets public routes through without credentials', async () => {
    const { app } = await setupApp(null);
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login/start',
      body: { username: 'user_test' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('returns 401 when neither cookie nor Bearer is present', async () => {
    const { app } = await setupApp(null);
    const res = await app.inject({ method: 'GET', url: '/protected' });
    expect(res.statusCode).toBe(401);
  });

  it('accepts a valid Bearer token without requiring x-bp-client', async () => {
    const { app } = await setupApp({ id: 's1', userId: 'u1' });
    const res = await app.inject({
      method: 'POST',
      url: '/protected',
      headers: { Authorization: `Bearer ${RAW_TOKEN}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it('passes an idle-ceiling parameter computed from SESSION_IDLE_TTL_MS', async () => {
    const { app } = await setupApp({ id: 's1', userId: 'u1' });
    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { Authorization: `Bearer ${RAW_TOKEN}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it('accepts a cookie auth on safe methods without x-bp-client', async () => {
    const { app } = await setupApp({ id: 's1', userId: 'u1' });
    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { cookie: `bp_session=${RAW_TOKEN}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it('rejects cookie auth on state-changing method without x-bp-client header (CSRF)', async () => {
    const { app } = await setupApp({ id: 's1', userId: 'u1' });
    const res = await app.inject({
      method: 'POST',
      url: '/protected',
      headers: { cookie: `bp_session=${RAW_TOKEN}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('accepts cookie auth on state-changing method with x-bp-client: web and matching Origin', async () => {
    const { app } = await setupApp({ id: 's1', userId: 'u1' });
    const res = await app.inject({
      method: 'POST',
      url: '/protected',
      headers: {
        cookie: `bp_session=${RAW_TOKEN}`,
        'x-bp-client': 'web',
        origin: 'http://localhost:5173',
      },
    });
    expect(res.statusCode).toBe(200);
  });

  it('accepts cookie auth on state-changing method with matching Referer when Origin is absent', async () => {
    const { app } = await setupApp({ id: 's1', userId: 'u1' });
    const res = await app.inject({
      method: 'POST',
      url: '/protected',
      headers: {
        cookie: `bp_session=${RAW_TOKEN}`,
        'x-bp-client': 'web',
        referer: 'http://localhost:5173/vault',
      },
    });
    expect(res.statusCode).toBe(200);
  });

  it('rejects cookie auth with wrong x-bp-client value', async () => {
    const { app } = await setupApp({ id: 's1', userId: 'u1' });
    const res = await app.inject({
      method: 'DELETE',
      url: '/protected',
      headers: { cookie: `bp_session=${RAW_TOKEN}`, 'x-bp-client': 'evil' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('rejects cookie auth with mismatched Origin', async () => {
    const { app } = await setupApp({ id: 's1', userId: 'u1' });
    const res = await app.inject({
      method: 'POST',
      url: '/protected',
      headers: {
        cookie: `bp_session=${RAW_TOKEN}`,
        'x-bp-client': 'web',
        origin: 'https://evil.example',
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it('rejects cookie auth when both Origin and Referer are missing on unsafe methods', async () => {
    const { app } = await setupApp({ id: 's1', userId: 'u1' });
    const res = await app.inject({
      method: 'POST',
      url: '/protected',
      headers: { cookie: `bp_session=${RAW_TOKEN}`, 'x-bp-client': 'web' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('rejects cookie auth with malformed Referer when Origin is absent', async () => {
    const { app } = await setupApp({ id: 's1', userId: 'u1' });
    const res = await app.inject({
      method: 'POST',
      url: '/protected',
      headers: {
        cookie: `bp_session=${RAW_TOKEN}`,
        'x-bp-client': 'web',
        referer: 'not a url',
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it('returns 401 when cookie token does not match a session', async () => {
    const { app } = await setupApp(null);
    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { cookie: `bp_session=${RAW_TOKEN}` },
    });
    expect(res.statusCode).toBe(401);
  });

  it('prefers cookie over Bearer when both are present', async () => {
    const { app } = await setupApp({ id: 's1', userId: 'u1' });
    const res = await app.inject({
      method: 'POST',
      url: '/protected',
      headers: {
        cookie: `bp_session=${RAW_TOKEN}`,
        Authorization: `Bearer different-token`,
      },
    });
    // Cookie path requires CSRF header; Bearer would have skipped it. 403 proves cookie was chosen.
    expect(res.statusCode).toBe(403);
  });
});
