import type { Keychain } from '@blindpass/types';
import { getSodium } from '@blindpass/crypto';

export async function lock(keychain: Keychain): Promise<void> {
  const sodium = await getSodium();
  sodium.memzero(keychain.masterKey);
  sodium.memzero(keychain.vaultKey);
}
