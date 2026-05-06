import { describe, it, expect } from 'vitest';
import { getSodium } from './sodium.js';
import { generateSalt } from './random.js';
import { deriveKeyEncryptionKey } from './kdf.js';

describe('kdf', () => {
  it('derives a 32-byte key', async () => {
    const sodium = await getSodium();
    const salt = await generateSalt();
    const key = await deriveKeyEncryptionKey(
      'password',
      salt,
      sodium.crypto_pwhash_OPSLIMIT_MIN,
      sodium.crypto_pwhash_MEMLIMIT_MIN,
    );
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.byteLength).toBe(32);
  });

  it('is deterministic — same inputs produce same key', async () => {
    const sodium = await getSodium();
    const salt = await generateSalt();
    const a = await deriveKeyEncryptionKey(
      'password',
      salt,
      sodium.crypto_pwhash_OPSLIMIT_MIN,
      sodium.crypto_pwhash_MEMLIMIT_MIN,
    );
    const b = await deriveKeyEncryptionKey(
      'password',
      salt,
      sodium.crypto_pwhash_OPSLIMIT_MIN,
      sodium.crypto_pwhash_MEMLIMIT_MIN,
    );
    expect(a).toEqual(b);
  });

  it('different salts produce different keys', async () => {
    const sodium = await getSodium();
    const saltA = await generateSalt();
    const saltB = await generateSalt();
    const a = await deriveKeyEncryptionKey(
      'password',
      saltA,
      sodium.crypto_pwhash_OPSLIMIT_MIN,
      sodium.crypto_pwhash_MEMLIMIT_MIN,
    );
    const b = await deriveKeyEncryptionKey(
      'password',
      saltB,
      sodium.crypto_pwhash_OPSLIMIT_MIN,
      sodium.crypto_pwhash_MEMLIMIT_MIN,
    );
    expect(a).not.toEqual(b);
  });

  it('different passwords produce different keys', async () => {
    const sodium = await getSodium();
    const salt = await generateSalt();
    const a = await deriveKeyEncryptionKey(
      'password1',
      salt,
      sodium.crypto_pwhash_OPSLIMIT_MIN,
      sodium.crypto_pwhash_MEMLIMIT_MIN,
    );
    const b = await deriveKeyEncryptionKey(
      'password2',
      salt,
      sodium.crypto_pwhash_OPSLIMIT_MIN,
      sodium.crypto_pwhash_MEMLIMIT_MIN,
    );
    expect(a).not.toEqual(b);
  });
});
