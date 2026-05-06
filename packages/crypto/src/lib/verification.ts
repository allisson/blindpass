import { entropyToMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { getSodium } from './sodium.js';

/**
 * Returns a stable BIP39 mnemonic of `sha256(publicKey)`. Used as a human-readable
 * fingerprint that two parties can compare out-of-band to verify each other's
 * publicKey before sharing.
 */
export async function verificationId(publicKey: Uint8Array): Promise<string> {
  const sodium = await getSodium();
  const hash = sodium.crypto_hash_sha256(publicKey);
  return entropyToMnemonic(hash, wordlist);
}
