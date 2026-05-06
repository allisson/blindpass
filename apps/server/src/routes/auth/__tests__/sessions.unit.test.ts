import { describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';
import { registerSessionsRoutes } from '../sessions.js';

const CALLER_ID = 'caller-user-id';
const SESSION_ID = 'current-session-id';
const OTHER_SESSION_ID = 'other-session-id';

function makeChain(result: unknown) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain['from'] = vi.fn().mockReturnValue(chain);
  chain['where'] = vi.fn().mockReturnValue(chain);
  chain['orderBy'] = vi.fn().mockResolvedValue(result);
  chain['returning'] = vi.fn().mockResolvedValue(result);
  return chain;
}

function buildApp(overrides?: { selectResult?: unknown[]; deleteResult?: unknown[] }) {
  const selectResult = overrides?.selectResult ?? [];
  const deleteResult = overrides?.deleteResult ?? [];
  const mockDb = {
    select: vi.fn(() => makeChain(selectResult)),
    delete: vi.fn(() => makeChain(deleteResult)),
  };
  const app = Fastify();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.decorate('db', mockDb as any);
  app.addHook('preHandler', async (request) => {
    request.userId = CALLER_ID;
    request.sessionId = SESSION_ID;
  });
  registerSessionsRoutes(app);
  return { app, mockDb };
}

describe('GET /auth/sessions', () => {
  it('returns 200 with empty sessions array when no sessions', async () => {
    const { app } = buildApp({ selectResult: [] });
    const res = await app.inject({ method: 'GET', url: '/auth/sessions' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ sessions: [] });
  });

  it('returns 200 with session list and isCurrent flag', async () => {
    const now = new Date().toISOString();
    const dbRows = [
      { id: SESSION_ID, createdAt: now, lastUsedAt: now, userAgent: 'Mozilla/5.0' },
      { id: OTHER_SESSION_ID, createdAt: now, lastUsedAt: now, userAgent: null },
    ];
    const { app } = buildApp({ selectResult: dbRows });
    const res = await app.inject({ method: 'GET', url: '/auth/sessions' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ sessions: { id: string; isCurrent: boolean }[] }>();
    expect(body.sessions).toHaveLength(2);
    expect(body.sessions[0]).toMatchObject({ id: SESSION_ID, isCurrent: true });
    expect(body.sessions[1]).toMatchObject({ id: OTHER_SESSION_ID, isCurrent: false });
  });

  it('handles null userAgent without error', async () => {
    const now = new Date().toISOString();
    const { app } = buildApp({
      selectResult: [{ id: SESSION_ID, createdAt: now, lastUsedAt: now, userAgent: null }],
    });
    const res = await app.inject({ method: 'GET', url: '/auth/sessions' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ sessions: { userAgent: null }[] }>();
    expect(body.sessions[0].userAgent).toBeNull();
  });
});

describe('DELETE /auth/sessions/:id', () => {
  it('returns 204 when session deleted', async () => {
    const { app } = buildApp({ deleteResult: [{ id: OTHER_SESSION_ID }] });
    const res = await app.inject({ method: 'DELETE', url: `/auth/sessions/${OTHER_SESSION_ID}` });
    expect(res.statusCode).toBe(204);
  });

  it('returns 404 when session not found', async () => {
    const { app } = buildApp({ deleteResult: [] });
    const res = await app.inject({ method: 'DELETE', url: '/auth/sessions/nonexistent-id' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: 'Session not found' });
  });
});

describe('DELETE /auth/sessions', () => {
  it('returns 204 and deletes all sessions except current', async () => {
    const { app, mockDb } = buildApp();
    const res = await app.inject({ method: 'DELETE', url: '/auth/sessions' });
    expect(res.statusCode).toBe(204);
    expect(mockDb.delete).toHaveBeenCalledOnce();
  });

  it('passes current session ID to WHERE clause so it is excluded', async () => {
    const whereCapture: unknown[] = [];
    const chain = {
      where: vi.fn((arg: unknown) => {
        whereCapture.push(arg);
        return Promise.resolve();
      }),
    };
    const mockDb = { delete: vi.fn().mockReturnValue(chain) };
    const app = Fastify();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    app.decorate('db', mockDb as any);
    app.addHook('preHandler', async (request) => {
      request.userId = CALLER_ID;
      request.sessionId = SESSION_ID;
    });
    registerSessionsRoutes(app);

    await app.inject({ method: 'DELETE', url: '/auth/sessions' });

    // The WHERE clause must reference the current session ID so it is preserved.
    // Drizzle SQL objects are circular, so use a replacer to serialize safely.
    const seen = new Set<unknown>();
    const serialized = JSON.stringify(whereCapture, (_, v) => {
      if (typeof v === 'object' && v !== null) {
        if (seen.has(v)) return '[Circular]';
        seen.add(v);
      }
      return v;
    });
    expect(serialized).toContain(SESSION_ID);
  });
});
