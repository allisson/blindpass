import { decryptSymmetric } from '@blindpass/crypto';
import type { KeyPair } from '@blindpass/types';
import type { KeysResponse } from '@blindpass/api-schema';
import { deriveKEK } from '@/lib/kdfWorker';
import { fromBase64, fromBase64EncryptedValue } from '@/lib/b64';
import { decryptKeyPair } from './decryptKeyPair.js';

export type UnlockResult = {
  masterKey: Uint8Array;
  keyPair: KeyPair;
};

export async function unlockWithPassword(
  password: string,
  keys: KeysResponse,
): Promise<UnlockResult> {
  const kek = await deriveKEK(password, fromBase64(keys.kekSalt));
  try {
    const masterKey = await decryptSymmetric(
      fromBase64EncryptedValue(keys.encryptedMasterKey),
      kek,
    );
    const keyPair = await decryptKeyPair(keys.encryptedPrivateKey, keys.publicKey, masterKey);
    return { masterKey, keyPair };
  } finally {
    kek.fill(0);
  }
}
