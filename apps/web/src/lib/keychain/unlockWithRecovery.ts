import { decryptMasterKeyWithRecovery } from '@blindpass/crypto';
import { fromBase64EncryptedValue } from '@/lib/b64';
import { decryptKeyPair } from './decryptKeyPair.js';
import type { UnlockResult } from './unlockWithPassword.js';

export type RecoveryBundle = {
  publicKey: string;
  encryptedMasterKeyForRecovery: { ciphertext: string; nonce: string };
  encryptedPrivateKey: { ciphertext: string; nonce: string };
};

export async function unlockWithRecovery(
  recoveryPhrase: string,
  bundle: RecoveryBundle,
): Promise<UnlockResult> {
  const masterKey = await decryptMasterKeyWithRecovery(
    fromBase64EncryptedValue(bundle.encryptedMasterKeyForRecovery),
    recoveryPhrase,
  );
  const keyPair = await decryptKeyPair(bundle.encryptedPrivateKey, bundle.publicKey, masterKey);
  return { masterKey, keyPair };
}
