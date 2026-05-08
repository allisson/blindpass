import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../users/repository.js', () => ({
  findCredentialsByUsername: vi.fn(),
  updateTotpCounter: vi.fn(),
}));
vi.mock('../../totp/verify-for-user.js', () => ({
  verifyAuthenticatorForUser: vi.fn(),
}));
vi.mock('../../session/index.js', () => ({
  issue: vi.fn(),
}));

import * as users from '../../users/repository.js';
import { verifyAuthenticatorForUser } from '../../totp/verify-for-user.js';
import * as session from '../../session/index.js';
import { completeLogin } from '../service.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = {} as any;

describe('completeLogin', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns invalid_credentials when user is missing', async () => {
    vi.mocked(users.findCredentialsByUsername).mockResolvedValue(undefined);
    expect(
      await completeLogin(db, { username: 'a', authenticatorCode: '000000', userAgent: undefined }),
    ).toEqual({
      ok: false,
      reason: 'invalid_credentials',
    });
    expect(verifyAuthenticatorForUser).not.toHaveBeenCalled();
  });

  it('returns invalid_credentials when user is unverified', async () => {
    vi.mocked(users.findCredentialsByUsername).mockResolvedValue({
      id: 'u1',
      verified: false,
      revokedAt: null,
    });
    const r = await completeLogin(db, {
      username: 'a',
      authenticatorCode: '000000',
      userAgent: undefined,
    });
    expect(r).toEqual({ ok: false, reason: 'invalid_credentials' });
  });

  it('returns invalid_credentials when user is revoked', async () => {
    vi.mocked(users.findCredentialsByUsername).mockResolvedValue({
      id: 'u1',
      verified: true,
      revokedAt: new Date(),
    });
    const r = await completeLogin(db, {
      username: 'a',
      authenticatorCode: '000000',
      userAgent: undefined,
    });
    expect(r).toEqual({ ok: false, reason: 'invalid_credentials' });
  });

  it('returns invalid_credentials when totp verification fails', async () => {
    vi.mocked(users.findCredentialsByUsername).mockResolvedValue({
      id: 'u1',
      verified: true,
      revokedAt: null,
    });
    vi.mocked(verifyAuthenticatorForUser).mockResolvedValue(null);
    const r = await completeLogin(db, {
      username: 'a',
      authenticatorCode: '000000',
      userAgent: undefined,
    });
    expect(r).toEqual({ ok: false, reason: 'invalid_credentials' });
    expect(users.updateTotpCounter).not.toHaveBeenCalled();
    expect(session.issue).not.toHaveBeenCalled();
  });

  it('updates the totp counter, issues a session, and returns the token on success', async () => {
    vi.mocked(users.findCredentialsByUsername).mockResolvedValue({
      id: 'u1',
      verified: true,
      revokedAt: null,
    });
    vi.mocked(verifyAuthenticatorForUser).mockResolvedValue(42);
    vi.mocked(session.issue).mockResolvedValue('tok-abc');

    const r = await completeLogin(db, {
      username: 'a',
      authenticatorCode: '123456',
      userAgent: 'curl/8',
    });

    expect(r).toEqual({ ok: true, authToken: 'tok-abc' });
    expect(users.updateTotpCounter).toHaveBeenCalledWith(db, 'u1', 42);
    expect(session.issue).toHaveBeenCalledWith(db, 'u1', 'curl/8');
  });
});
