import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../env.js', () => ({
  env: {
    RECOVERY_TOKEN_TTL_MS: 15 * 60 * 1000,
    PENDING_TOTP_TTL_MS: 30 * 60 * 1000,
  },
}));
vi.mock('../../users/repository.js', () => ({
  findFullByUsername: vi.fn(),
}));
vi.mock('../../enrollments/repository.js', () => ({
  deleteByUser: vi.fn(),
  createPending: vi.fn(),
}));
vi.mock('../../recovery-tokens/repository.js', () => ({
  deleteAllForUser: vi.fn(),
  create: vi.fn(),
}));
vi.mock('../verifier.js', () => ({
  verify: vi.fn(),
}));
vi.mock('../../totp/index.js', () => ({
  enroll: vi.fn(),
}));

import * as users from '../../users/repository.js';
import * as enrollments from '../../enrollments/repository.js';
import * as recoveryTokens from '../../recovery-tokens/repository.js';
import * as verifier from '../verifier.js';
import * as totp from '../../totp/index.js';
import { verifyRecovery } from '../service.js';
import { fixedClock } from '../../../test/fake-clock.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = {} as any;

const validUser = {
  id: 'u1',
  username: 'alice',
  verified: true,
  revokedAt: null,
  publicKey: Buffer.from('pk'),
  kekSalt: Buffer.from('ks'),
  recoveryVerifierHash: Buffer.from('hash'),
  recoveryVerifierSalt: Buffer.from('salt'),
};

describe('verifyRecovery', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns invalid_credentials when the user is missing', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(users.findFullByUsername).mockResolvedValue(undefined as any);

    const result = await verifyRecovery(
      db,
      { username: 'alice', recoveryVerifier: 'phrase' },
      fixedClock(0),
    );

    expect(result).toEqual({ ok: false, reason: 'invalid_credentials' });
    expect(recoveryTokens.create).not.toHaveBeenCalled();
  });

  it('returns invalid_credentials when the verifier rejects the phrase', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(users.findFullByUsername).mockResolvedValue(validUser as any);
    vi.mocked(verifier.verify).mockReturnValue(false);

    const result = await verifyRecovery(
      db,
      { username: 'alice', recoveryVerifier: 'wrong' },
      fixedClock(0),
    );

    expect(result).toEqual({ ok: false, reason: 'invalid_credentials' });
    expect(recoveryTokens.create).not.toHaveBeenCalled();
  });

  it('stamps recovery token + enrollment expiry off the injected clock', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(users.findFullByUsername).mockResolvedValue(validUser as any);
    vi.mocked(verifier.verify).mockReturnValue(true);
    vi.mocked(enrollments.createPending).mockResolvedValue('enrollment-id');
    vi.mocked(totp.enroll).mockReturnValue({
      plaintextSecret: 'SECRET',
      encryptedSecret: Buffer.from('enc'),
      qrUri: 'otpauth://...',
      expiresAt: new Date(0).toISOString(),
    });

    const FIXED_NOW = 1_700_000_000_000;
    const RECOVERY_TTL = 15 * 60 * 1000;
    const ENROLLMENT_TTL = 30 * 60 * 1000;

    const result = await verifyRecovery(
      db,
      { username: 'alice', recoveryVerifier: 'phrase' },
      fixedClock(FIXED_NOW),
    );

    expect(result.ok).toBe(true);

    // recoveryTokens.create receives expiresAt computed from the clock —
    // not from `Date.now()`. This is the seam the test exists to prove.
    expect(recoveryTokens.create).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        expiresAt: new Date(FIXED_NOW + RECOVERY_TTL),
      }),
    );

    // Same for the pending TOTP enrollment.
    expect(enrollments.createPending).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        expiresAt: new Date(FIXED_NOW + ENROLLMENT_TTL),
      }),
    );

    // totp.enroll is called with the enrollment expiry derived from clock.
    expect(totp.enroll).toHaveBeenCalledWith('alice', new Date(FIXED_NOW + ENROLLMENT_TTL));
  });

  it('purges prior tokens and enrollments before issuing new ones', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(users.findFullByUsername).mockResolvedValue(validUser as any);
    vi.mocked(verifier.verify).mockReturnValue(true);
    vi.mocked(enrollments.createPending).mockResolvedValue('enrollment-id');
    vi.mocked(totp.enroll).mockReturnValue({
      plaintextSecret: 'SECRET',
      encryptedSecret: Buffer.from('enc'),
      qrUri: 'otpauth://...',
      expiresAt: new Date(0).toISOString(),
    });

    await verifyRecovery(db, { username: 'alice', recoveryVerifier: 'phrase' }, fixedClock(0));

    expect(recoveryTokens.deleteAllForUser).toHaveBeenCalledWith(db, 'u1');
    expect(enrollments.deleteByUser).toHaveBeenCalledWith(db, 'u1');
  });
});
