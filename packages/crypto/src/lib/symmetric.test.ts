import { describe, it, expect } from 'vitest';
import { generateKey } from './random.js';
import { encryptSymmetric, decryptSymmetric } from './symmetric.js';
import { CryptoError } from '../errors.js';

describe('symmetric', () => {
  it('round-trip returns original plaintext', async () => {
    const key = await generateKey();
    const plaintext = new TextEncoder().encode('hello blindpass');
    const encrypted = await encryptSymmetric(plaintext, key);
    const decrypted = await decryptSymmetric(encrypted, key);
    expect(decrypted).toEqual(plaintext);
  });

  it('encrypted ciphertext differs from plaintext', async () => {
    const key = await generateKey();
    const plaintext = new TextEncoder().encode('secret');
    const encrypted = await encryptSymmetric(plaintext, key);
    expect(encrypted.ciphertext).not.toEqual(plaintext);
  });

  it('two encryptions of same plaintext produce different ciphertexts', async () => {
    const key = await generateKey();
    const plaintext = new TextEncoder().encode('same input');
    const a = await encryptSymmetric(plaintext, key);
    const b = await encryptSymmetric(plaintext, key);
    expect(a.ciphertext).not.toEqual(b.ciphertext);
    expect(a.nonce).not.toEqual(b.nonce);
  });

  it('decryption with wrong key throws', async () => {
    const key = await generateKey();
    const wrongKey = await generateKey();
    const plaintext = new TextEncoder().encode('secret');
    const encrypted = await encryptSymmetric(plaintext, key);
    await expect(decryptSymmetric(encrypted, wrongKey)).rejects.toThrow(CryptoError);
  });
});
