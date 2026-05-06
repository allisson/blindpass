import { generateKey } from '../lib/random.js';
import { encryptSymmetric, decryptSymmetric } from '../lib/symmetric.js';
import { getSodium } from '../lib/sodium.js';
import type { EncryptedValue } from '@blindpass/types';
import { entropyToMnemonic, mnemonicToEntropy } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

export async function generateRecoveryKey(): Promise<string> {
  const entropy = await generateKey();
  return entropyToMnemonic(entropy, wordlist);
}

export async function encryptRecoveryKey(
  mnemonic: string,
  masterKey: Uint8Array,
): Promise<EncryptedValue> {
  const plaintext = new TextEncoder().encode(mnemonic);
  return encryptSymmetric(plaintext, masterKey);
}

export async function decryptRecoveryKey(
  encrypted: EncryptedValue,
  masterKey: Uint8Array,
): Promise<string> {
  const plaintext = await decryptSymmetric(encrypted, masterKey);
  return new TextDecoder().decode(plaintext);
}

export async function encryptMasterKeyWithRecovery(
  masterKey: Uint8Array,
  mnemonic: string,
): Promise<EncryptedValue> {
  const sodium = await getSodium();
  const entropy = mnemonicToEntropy(mnemonic, wordlist);
  try {
    return await encryptSymmetric(masterKey, entropy);
  } finally {
    sodium.memzero(entropy);
  }
}

export async function decryptMasterKeyWithRecovery(
  encrypted: EncryptedValue,
  mnemonic: string,
): Promise<Uint8Array> {
  const sodium = await getSodium();
  const entropy = mnemonicToEntropy(mnemonic, wordlist);
  try {
    return await decryptSymmetric(encrypted, entropy);
  } finally {
    sodium.memzero(entropy);
  }
}
