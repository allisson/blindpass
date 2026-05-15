import { describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { attachCookie, issue, type ProofOfSession } from '../index.js';
import { hashToken } from '../../../utils/otp.js';
import { fixedClock } from '../../../test/fake-clock.js';

vi.mock('../../../env.js', () => ({
  env: {
    COOKIE_NAME: 'bp_session',
    COOKIE_SECURE: false,
    COOKIE_DOMAIN: undefined,
    SESSION_TTL_MS: 60_000,
  },
}));

describe('session.issue', () => {
  it('inserts a row with hashed token, ttl-based expiry, and returns a proof', async () => {
    const captured: { row?: Record<string, unknown> } = {};
    const db = {
      insert: () => ({
        values: vi.fn(async (row: Record<string, unknown>) => {
          captured.row = row;
        }),
      }),
    };

    const fixedNow = 1_700_000_000_000;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proof = await issue(db as any, 'user-1', 'curl/8.0', fixedClock(fixedNow));

    expect(proof.token).toMatch(/^[0-9a-f]{64}$/);
    expect(captured.row?.['userId']).toBe('user-1');
    expect(captured.row?.['userAgent']).toBe('curl/8.0');
    expect(captured.row?.['tokenHash']).toBe(hashToken(proof.token));

    const expiresAt = captured.row?.['expiresAt'] as Date;
    expect(expiresAt.getTime()).toBe(fixedNow + 60_000);
  });

  it('returns a proof that JSON.stringify drops to undefined', async () => {
    const db = {
      insert: () => ({ values: vi.fn(async () => undefined) }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proof = await issue(db as any, 'user-1', undefined, fixedClock(0));
    expect(JSON.stringify(proof)).toBeUndefined();
    expect(JSON.stringify({ proof })).toBe('{}');
  });

  it('returns a proof whose token is non-enumerable (spread and keys are empty)', async () => {
    const db = {
      insert: () => ({ values: vi.fn(async () => undefined) }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proof = await issue(db as any, 'user-1', undefined, fixedClock(0));
    expect(Object.keys(proof)).toEqual([]);
    expect({ ...proof }).toEqual({});
    expect(Object.assign({}, proof)).toEqual({});
    // The token remains readable for the legitimate consumer.
    expect(proof.token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('passes undefined userAgent through', async () => {
    const captured: { row?: Record<string, unknown> } = {};
    const db = {
      insert: () => ({
        values: vi.fn(async (row: Record<string, unknown>) => {
          captured.row = row;
        }),
      }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await issue(db as any, 'user-2', undefined, fixedClock(0));
    expect(captured.row?.['userAgent']).toBeUndefined();
  });
});

describe('session.attachCookie', () => {
  it('sets an httpOnly strict cookie with the configured name and ttl', async () => {
    const app = Fastify();
    await app.register(cookie);
    app.get('/x', async (_req, reply) => {
      const proof = { token: 'rawtoken123' } as unknown as ProofOfSession;
      attachCookie(reply, proof);
      return { ok: true };
    });
    const res = await app.inject({ method: 'GET', url: '/x' });
    const setCookie = res.headers['set-cookie'];
    const header = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    expect(header).toContain('bp_session=rawtoken123');
    expect(header).toContain('HttpOnly');
    expect(header).toContain('SameSite=Strict');
    expect(header).toContain('Max-Age=60');
  });
});
