import type { KeyPair } from '@blindpass/types';
import { getSodium } from './sodium.js';
import { CryptoError } from '../errors.js';

/** Generates a fresh X25519 key pair for asymmetric encryption (`sealBox`/`openSealBox`). */
export async function generateKeyPair(): Promise<KeyPair> {
  const sodium = await getSodium();
  const kp = sodium.crypto_box_keypair();
  return { publicKey: kp.publicKey, privateKey: kp.privateKey };
}

/**
 * Encrypts plaintext to a recipient's public key (X25519 + XSalsa20-Poly1305 anonymous box).
 * Only the holder of the corresponding private key can decrypt via `openSealBox`.
 */
export async function sealBox(plaintext: Uint8Array, publicKey: Uint8Array): Promise<Uint8Array> {
  const sodium = await getSodium();
  return sodium.crypto_box_seal(plaintext, publicKey);
}

/**
 * Decrypts a `sealBox` ciphertext using the recipient's key pair.
 * Throws `CryptoError` if authentication fails (wrong key pair or corrupted data).
 */
export async function openSealBox(ciphertext: Uint8Array, keyPair: KeyPair): Promise<Uint8Array> {
  const sodium = await getSodium();
  /* c8 ignore start — libsodium throws on auth failure; v8 can't attribute async catch branch */
  try {
    return sodium.crypto_box_seal_open(ciphertext, keyPair.publicKey, keyPair.privateKey);
  } catch {
    throw new CryptoError('Decryption failed: invalid key pair or corrupted data');
  }
  /* c8 ignore stop */
}
