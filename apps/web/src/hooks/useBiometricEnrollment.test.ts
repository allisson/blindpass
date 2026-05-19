import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';

const { sessionMock } = vi.hoisted(() => ({
  sessionMock: { get: vi.fn(), set: vi.fn() },
}));
vi.mock('@/lib/session', () => ({
  session: sessionMock,
  getLastUsername: () => 'tester',
}));

const { registerBiometricMock, probePrfSupportMock, getBiometricLabelMock } = vi.hoisted(() => ({
  registerBiometricMock: vi.fn(),
  probePrfSupportMock: vi.fn(),
  getBiometricLabelMock: vi.fn(),
}));
vi.mock('@/lib/biometric', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/biometric')>();
  return {
    ...actual,
    probePrfSupport: probePrfSupportMock,
    registerBiometric: registerBiometricMock,
    getBiometricLabel: getBiometricLabelMock,
  };
});

vi.mock('@/lib/biometric/buk', () => ({
  wrapMasterKey: vi
    .fn()
    .mockResolvedValue({ ciphertext: new Uint8Array([5]), nonce: new Uint8Array([6]) }),
}));

vi.mock('@blindpass/crypto', () => ({
  generateKey: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4])),
}));

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    registerBiometricCredential: vi.fn(),
    deleteBiometricCredential: vi.fn(),
  },
}));
vi.mock('@/lib/api', () => ({ api: apiMock }));

import { useBiometricEnrollment } from './useBiometricEnrollment';
import { enrollmentStore, ENROLLMENT_VERSION } from '@/lib/biometric';

const MASTER_KEY = new Uint8Array([10, 11, 12]);
const CREDENTIAL_ID = new Uint8Array([20, 21, 22]);
const PRF_OUTPUT = new Uint8Array([30, 31, 32]);

function setupHappyPath(label: string | null = 'MacBook Touch ID') {
  probePrfSupportMock.mockResolvedValue({ supported: true });
  getBiometricLabelMock.mockReturnValue(label);
  registerBiometricMock.mockResolvedValue({ credentialId: CREDENTIAL_ID, prfOutput: PRF_OUTPUT });
  apiMock.registerBiometricCredential.mockResolvedValue({
    id: 'server-uuid-123',
    createdAt: '2024-01-01T00:00:00.000Z',
  });
  apiMock.deleteBiometricCredential.mockResolvedValue(undefined);
  sessionMock.get.mockReturnValue({
    username: 'tester',
    keychain: { masterKey: MASTER_KEY },
  });
}

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory());
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useBiometricEnrollment', () => {
  describe('enroll', () => {
    it('calls registerBiometricCredential with base64 credentialId and label', async () => {
      setupHappyPath('My Device');
      const { result } = renderHook(() => useBiometricEnrollment());
      await waitFor(() => expect(result.current.phase).toBe('idle'));

      await act(async () => {
        await result.current.enroll();
      });

      expect(apiMock.registerBiometricCredential).toHaveBeenCalledOnce();
      const call = apiMock.registerBiometricCredential.mock.calls[0][0] as {
        credentialId: string;
        label?: string;
      };
      expect(typeof call.credentialId).toBe('string');
      expect(call.label).toBe('My Device');
    });

    it('persists serverCredentialId from API response to enrollment store', async () => {
      setupHappyPath();
      const { result } = renderHook(() => useBiometricEnrollment());
      await waitFor(() => expect(result.current.phase).toBe('idle'));

      await act(async () => {
        await result.current.enroll();
      });

      const stored = await enrollmentStore.get('tester');
      expect(stored?.serverCredentialId).toBe('server-uuid-123');
    });

    it('omits label when getBiometricLabel returns null', async () => {
      setupHappyPath(null);
      const { result } = renderHook(() => useBiometricEnrollment());
      await waitFor(() => expect(result.current.phase).toBe('idle'));

      await act(async () => {
        await result.current.enroll();
      });

      const call = apiMock.registerBiometricCredential.mock.calls[0][0] as {
        label?: string;
      };
      expect(call.label).toBeUndefined();
    });

    it('sets phase to done and isEnrolled to true after successful enrollment', async () => {
      setupHappyPath();
      const { result } = renderHook(() => useBiometricEnrollment());
      await waitFor(() => expect(result.current.phase).toBe('idle'));

      await act(async () => {
        await result.current.enroll();
      });

      expect(result.current.phase).toBe('done');
      expect(result.current.isEnrolled).toBe(true);
    });
  });

  describe('disenroll', () => {
    it('calls deleteBiometricCredential with the stored serverCredentialId', async () => {
      await enrollmentStore.put({
        version: ENROLLMENT_VERSION,
        username: 'tester',
        credentialId: CREDENTIAL_ID,
        prfSalt: new Uint8Array([2]),
        encryptedMasterKey: { ciphertext: new Uint8Array([3]), nonce: new Uint8Array([4]) },
        rpId: 'localhost',
        createdAt: 'now',
        serverCredentialId: 'server-uuid-456',
      });
      probePrfSupportMock.mockResolvedValue({ supported: true });
      apiMock.deleteBiometricCredential.mockResolvedValue(undefined);

      const { result } = renderHook(() => useBiometricEnrollment());
      await waitFor(() => expect(result.current.phase).toBe('idle'));

      await act(async () => {
        await result.current.disenroll();
      });

      expect(apiMock.deleteBiometricCredential).toHaveBeenCalledWith('server-uuid-456');
      expect(await enrollmentStore.get('tester')).toBeNull();
    });

    it('skips deleteBiometricCredential when enrollment has no serverCredentialId', async () => {
      await enrollmentStore.put({
        version: ENROLLMENT_VERSION,
        username: 'tester',
        credentialId: CREDENTIAL_ID,
        prfSalt: new Uint8Array([2]),
        encryptedMasterKey: { ciphertext: new Uint8Array([3]), nonce: new Uint8Array([4]) },
        rpId: 'localhost',
        createdAt: 'now',
      });
      probePrfSupportMock.mockResolvedValue({ supported: true });

      const { result } = renderHook(() => useBiometricEnrollment());
      await waitFor(() => expect(result.current.phase).toBe('idle'));

      await act(async () => {
        await result.current.disenroll();
      });

      expect(apiMock.deleteBiometricCredential).not.toHaveBeenCalled();
      expect(await enrollmentStore.get('tester')).toBeNull();
    });
  });
});
