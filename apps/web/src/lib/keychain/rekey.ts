import {
  encryptSymmetric,
  encryptMasterKeyWithRecovery,
  encryptRecoveryKey,
  generateRecoveryKey,
} from '@blindpass/crypto';
import { deriveKEK } from '@/lib/kdfWorker';
import { toBase64, toBase64EncryptedValue } from '@/lib/b64';

export type RekeyResult = {
  newRecoveryKey: string;
  kekSalt: string;
  encryptedMasterKey: { ciphertext: string; nonce: string };
  encryptedMasterKeyForRecovery: { ciphertext: string; nonce: string };
  encryptedRecoveryKey: { ciphertext: string; nonce: string };
  recoveryVerifier: string;
};

export async function rekey(masterKey: Uint8Array, newPassword: string): Promise<RekeyResult> {
  const newKekSalt = crypto.getRandomValues(new Uint8Array(16));
  const newKek = await deriveKEK(newPassword, newKekSalt);
  try {
    const newRecoveryKey = await generateRecoveryKey();
    const newEncryptedMasterKey = await encryptSymmetric(masterKey, newKek);
    const newEncryptedMasterKeyForRecovery = await encryptMasterKeyWithRecovery(
      masterKey,
      newRecoveryKey,
    );
    const newEncryptedRecoveryKey = await encryptRecoveryKey(newRecoveryKey, masterKey);
    return {
      newRecoveryKey,
      kekSalt: toBase64(newKekSalt),
      encryptedMasterKey: toBase64EncryptedValue(newEncryptedMasterKey),
      encryptedMasterKeyForRecovery: toBase64EncryptedValue(newEncryptedMasterKeyForRecovery),
      encryptedRecoveryKey: toBase64EncryptedValue(newEncryptedRecoveryKey),
      recoveryVerifier: toBase64(new TextEncoder().encode(newRecoveryKey)),
    };
  } finally {
    newKek.fill(0);
  }
}
