import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../users/repository.js', () => ({
  findFullByUsername: vi.fn(),
  findFullById: vi.fn(),
  markVerifiedAndCounter: vi.fn(),
}));
vi.mock('../../enrollments/repository.js', () => ({
  findPending: vi.fn(),
  bumpAttempts: vi.fn(),
  deleteById: vi.fn(),
  deleteByUser: vi.fn(),
}));
vi.mock('../../totp-secrets/repository.js', () => ({
  replaceForUser: vi.fn(),
}));
vi.mock('../../totp/index.js', () => ({
  verify: vi.fn(),
}));
vi.mock('../../session/index.js', () => ({
  issue: vi.fn(),
}));

import * as users from '../../users/repository.js';
import * as enrollments from '../../enrollments/repository.js';
import * as totpSecrets from '../../totp-secrets/repository.js';
import * as totp from '../../totp/index.js';
import * as session from '../../session/index.js';
import { completeRegistration } from '../service.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = {} as any;
const baseInput = {
  username: 'alice',
  enrollmentId: 'e1',
  authenticatorCode: '123456',
  userAgent: 'curl/8',
};

const verifiedUser = {
  id: 'u1',
  verified: false,
  revokedAt: null,
  totpLastUsedCounter: null,
  publicKey: Buffer.from('pk'),
  kekSalt: Buffer.from('ks'),
  encryptedMasterKeyCiphertext: null,
  encryptedMasterKeyNonce: null,
  encryptedMasterKeyForRecoveryCiphertext: null,
  encryptedMasterKeyForRecoveryNonce: null,
  encryptedPrivateKeyCiphertext: null,
  encryptedPrivateKeyNonce: null,
  encryptedRecoveryKeyCiphertext: null,
  encryptedRecoveryKeyNonce: null,
};

const enrollment = {
  id: 'e1',
  userId: 'u1',
  encryptedSecret: Buffer.from('enc'),
  attempts: 0,
};

describe('completeRegistration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects when user is missing', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(users.findFullByUsername).mockResolvedValue(undefined as any);
    expect(await completeRegistration(db, baseInput)).toEqual({
      ok: false,
      reason: 'invalid_enrollment',
    });
  });

  it('rejects when user is already verified', async () => {
    vi.mocked(users.findFullByUsername).mockResolvedValue({
      ...verifiedUser,
      verified: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    expect(await completeRegistration(db, baseInput)).toEqual({
      ok: false,
      reason: 'invalid_enrollment',
    });
  });

  it('rejects when no pending enrollment is found', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(users.findFullByUsername).mockResolvedValue(verifiedUser as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(enrollments.findPending).mockResolvedValue(undefined as any);
    expect(await completeRegistration(db, baseInput)).toEqual({
      ok: false,
      reason: 'invalid_enrollment',
    });
  });

  it('bumps attempts on bad code; deletes enrollment after 3 failed attempts', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(users.findFullByUsername).mockResolvedValue(verifiedUser as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(enrollments.findPending).mockResolvedValue({ ...enrollment, attempts: 2 } as any);
    vi.mocked(totp.verify).mockReturnValue(null);

    expect(await completeRegistration(db, baseInput)).toEqual({
      ok: false,
      reason: 'invalid_enrollment',
    });
    expect(enrollments.bumpAttempts).toHaveBeenCalledWith(db, 'e1', 3);
    expect(enrollments.deleteById).toHaveBeenCalledWith(db, 'e1');
  });

  it('bumps attempts on bad code; does not delete below threshold', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(users.findFullByUsername).mockResolvedValue(verifiedUser as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(enrollments.findPending).mockResolvedValue({ ...enrollment, attempts: 0 } as any);
    vi.mocked(totp.verify).mockReturnValue(null);

    await completeRegistration(db, baseInput);
    expect(enrollments.bumpAttempts).toHaveBeenCalledWith(db, 'e1', 1);
    expect(enrollments.deleteById).not.toHaveBeenCalled();
  });

  it('rejects with not_provisioned if the user lacks publicKey/kekSalt', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(users.findFullByUsername).mockResolvedValue(verifiedUser as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(enrollments.findPending).mockResolvedValue(enrollment as any);
    vi.mocked(totp.verify).mockReturnValue(7);
    vi.mocked(session.issue).mockResolvedValue({
      token: 'tok',
    } as unknown as session.ProofOfSession);
    vi.mocked(users.findFullById).mockResolvedValue({
      ...verifiedUser,
      publicKey: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    expect(await completeRegistration(db, baseInput)).toEqual({
      ok: false,
      reason: 'not_provisioned',
    });
  });

  it('rotates totp secret, marks verified, issues session, returns bundle on success', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(users.findFullByUsername).mockResolvedValue(verifiedUser as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(enrollments.findPending).mockResolvedValue(enrollment as any);
    vi.mocked(totp.verify).mockReturnValue(7);
    const fakeProof = { token: 'tok-xyz' } as unknown as session.ProofOfSession;
    vi.mocked(session.issue).mockResolvedValue(fakeProof);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(users.findFullById).mockResolvedValue(verifiedUser as any);

    const r = await completeRegistration(db, baseInput);

    expect(r.ok).toBe(true);
    if (r.ok) expect(r.proof).toBe(fakeProof);

    expect(totpSecrets.replaceForUser).toHaveBeenCalledWith(db, 'u1', enrollment.encryptedSecret);
    expect(enrollments.deleteByUser).toHaveBeenCalledWith(db, 'u1');
    expect(users.markVerifiedAndCounter).toHaveBeenCalledWith(db, 'u1', 7);
    expect(session.issue).toHaveBeenCalledWith(db, 'u1', 'curl/8');
  });
});
