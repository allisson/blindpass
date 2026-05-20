import { getSodium, type Keychain } from '@blindpass/crypto';

export async function lock(keychain: Keychain): Promise<void> {
  const sodium = await getSodium();
  sodium.memzero(keychain.masterKey);
  sodium.memzero(keychain.vaultKey);
}
