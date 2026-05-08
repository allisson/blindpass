import {
  encryptSymmetric,
  encryptMasterKeyWithRecovery,
  encryptRecoveryKey,
  generateKeyPair,
  generateKey,
  generateRecoveryKey,
  generateSalt,
} from '@blindpass/crypto';
import { encryptVaultMetadata } from '@blindpass/vault';
import type { RegisterRequest } from '@blindpass/api-schema';
import { deriveKEK } from '@/lib/kdfWorker';
import { toBase64, toBase64EncryptedValue } from '@/lib/b64';

export type BootstrapResult = {
  registerBody: Omit<RegisterRequest, 'username'>;
  masterKey: Uint8Array;
  vaultKey: Uint8Array;
  publicKey: Uint8Array;
  recoveryKey: string;
};

export async function bootstrap(password: string): Promise<BootstrapResult> {
  const kekSalt = await generateSalt();
  const kek = await deriveKEK(password, kekSalt);
  try {
    const masterKey = await generateKey();
    const recoveryKey = await generateRecoveryKey();
    const { publicKey, privateKey } = await generateKeyPair();
    const vaultKey = await generateKey();

    try {
      const encryptedMasterKey = await encryptSymmetric(masterKey, kek);
      const encryptedMasterKeyForRecovery = await encryptMasterKeyWithRecovery(
        masterKey,
        recoveryKey,
      );
      const encryptedPrivateKey = await encryptSymmetric(privateKey, masterKey);
      const encryptedRecoveryKey = await encryptRecoveryKey(recoveryKey, masterKey);
      const encryptedVaultKey = await encryptSymmetric(vaultKey, masterKey);
      const encryptedVaultData = await encryptVaultMetadata({ name: 'My Vault' }, vaultKey);

      return {
        registerBody: {
          kekSalt: toBase64(kekSalt),
          publicKey: toBase64(publicKey),
          encryptedMasterKey: toBase64EncryptedValue(encryptedMasterKey),
          encryptedMasterKeyForRecovery: toBase64EncryptedValue(encryptedMasterKeyForRecovery),
          encryptedPrivateKey: toBase64EncryptedValue(encryptedPrivateKey),
          encryptedRecoveryKey: toBase64EncryptedValue(encryptedRecoveryKey),
          encryptedVaultKey: toBase64EncryptedValue(encryptedVaultKey),
          encryptedVaultData: toBase64EncryptedValue(encryptedVaultData),
          recoveryVerifier: toBase64(new TextEncoder().encode(recoveryKey)),
        },
        masterKey,
        vaultKey,
        publicKey,
        recoveryKey,
      };
    } finally {
      privateKey.fill(0);
    }
  } finally {
    kek.fill(0);
  }
}
