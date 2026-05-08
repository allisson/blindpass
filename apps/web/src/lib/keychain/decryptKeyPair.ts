import { decryptSymmetric } from '@blindpass/crypto';
import type { KeyPair } from '@blindpass/types';
import { fromBase64, fromBase64EncryptedValue } from '@/lib/b64';

export async function decryptKeyPair(
  encryptedPrivateKey: { ciphertext: string; nonce: string },
  publicKey: string,
  masterKey: Uint8Array,
): Promise<KeyPair> {
  const privateKey = await decryptSymmetric(
    fromBase64EncryptedValue(encryptedPrivateKey),
    masterKey,
  );
  return { publicKey: fromBase64(publicKey), privateKey };
}
