import { describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { registerLogoutRoute } from '../logout.js';

vi.mock('../../../env.js', () => ({
  env: {
    COOKIE_NAME: 'bp_session',
    COOKIE_DOMAIN: undefined,
  },
}));

function buildApp() {
  const dbDelete = vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue([]),
  });
  const mockDb = { delete: dbDelete };
  const app = Fastify();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.decorate('db', mockDb as any);
  // Inject sessionId/userId on requests to mimic auth-plugin behavior.
  app.addHook('onRequest', async (req) => {
    req.sessionId = 'session-1';
    req.userId = 'user-1';
  });
  return { app, dbDelete };
}

describe('POST /auth/logout', () => {
  it('deletes session row and clears the cookie', async () => {
    const { app, dbDelete } = buildApp();
    await app.register(cookie);
    registerLogoutRoute(app);

    const res = await app.inject({ method: 'POST', url: '/auth/logout' });
    expect(res.statusCode).toBe(204);
    expect(dbDelete).toHaveBeenCalledOnce();

    const setCookie = res.headers['set-cookie'];
    const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : (setCookie ?? '');
    expect(cookieStr).toMatch(/bp_session=;/);
    expect(cookieStr).toMatch(/Path=\//);
  });
});
