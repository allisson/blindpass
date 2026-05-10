import type { KeysResponse } from '@blindpass/api-schema';
import { unwrapMasterKey } from '@/lib/biometric/buk';
import { assertBiometric } from '@/lib/biometric/webauthn';
import type { BiometricEnrollment } from '@/lib/biometric/enrollmentStore';
import { decryptKeyPair } from './decryptKeyPair.js';
import type { UnlockResult } from './unlockWithPassword.js';

/**
 * Recovers MasterKey from a local BiometricEnrollment by deriving a BUK via
 * WebAuthn PRF. Throws on assertion failure (NotAllowedError, InvalidStateError, etc.).
 */
export async function unlockWithBiometric(
  enrollment: BiometricEnrollment,
  keys: KeysResponse,
): Promise<UnlockResult> {
  const buk = await assertBiometric({
    rpId: enrollment.rpId,
    credentialId: enrollment.credentialId,
    prfSalt: enrollment.prfSalt,
  });
  const masterKey = await unwrapMasterKey(enrollment.encryptedMasterKey, buk);
  const keyPair = await decryptKeyPair(keys.encryptedPrivateKey, keys.publicKey, masterKey);
  return { masterKey, keyPair };
}
