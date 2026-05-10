import { afterEach, describe, expect, it, vi } from 'vitest';
import { encryptSymmetric, generateKey, generateKeyPair } from '@blindpass/crypto';
import { toBase64, toBase64EncryptedValue } from '@/lib/b64';
import type { BiometricEnrollment } from '@/lib/biometric/enrollmentStore';
import { ENROLLMENT_VERSION } from '@/lib/biometric/enrollmentStore';
import { unlockWithBiometric } from './unlockWithBiometric';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('unlockWithBiometric', () => {
  it('returns masterKey + keyPair when assertion + unwrap succeed', async () => {
    const masterKey = await generateKey();
    const buk = await generateKey();
    const encryptedMasterKey = await encryptSymmetric(masterKey, buk);

    const kp = await generateKeyPair();
    const encryptedPrivateKey = await encryptSymmetric(kp.privateKey, masterKey);

    const enrollment: BiometricEnrollment = {
      version: ENROLLMENT_VERSION,
      username: 'tester',
      credentialId: new Uint8Array([1]),
      prfSalt: new Uint8Array([2]),
      encryptedMasterKey,
      rpId: 'localhost',
      createdAt: 'now',
    };

    vi.stubGlobal('navigator', {
      credentials: {
        get: vi.fn().mockResolvedValue({
          getClientExtensionResults: () => ({
            prf: { results: { first: new Uint8Array(buk).buffer } },
          }),
        }),
      },
    } as unknown as Navigator);
    vi.stubGlobal('crypto', {
      getRandomValues: (arr: Uint8Array) => arr.fill(0),
    } as unknown as Crypto);

    const out = await unlockWithBiometric(enrollment, {
      kekSalt: 'unused',
      publicKey: toBase64(kp.publicKey),
      encryptedMasterKey: toBase64EncryptedValue(encryptedMasterKey),
      encryptedPrivateKey: toBase64EncryptedValue(encryptedPrivateKey),
    } as never);

    expect(out.keyPair.publicKey).toEqual(kp.publicKey);
    expect(out.keyPair.privateKey).toEqual(kp.privateKey);
  });
});
