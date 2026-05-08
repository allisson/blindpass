import { describe, it, expect, beforeAll } from 'vitest';
import { generateKey, CryptoError } from '@blindpass/crypto';
import { encryptVaultMetadata, decryptVaultMetadata } from '../metadata.js';

let vaultKey: Uint8Array;

beforeAll(async () => {
  vaultKey = await generateKey();
});

describe('encryptVaultMetadata / decryptVaultMetadata', () => {
  it('round-trips vault metadata', async () => {
    const metadata = { name: 'Work' };
    const encrypted = await encryptVaultMetadata(metadata, vaultKey);
    const decrypted = await decryptVaultMetadata(encrypted, vaultKey);
    expect(decrypted).toEqual(metadata);
  });

  it('throws CryptoError on tampered ciphertext', async () => {
    const encrypted = await encryptVaultMetadata({ name: 'Personal' }, vaultKey);
    encrypted.ciphertext[0] ^= 0xff;
    await expect(decryptVaultMetadata(encrypted, vaultKey)).rejects.toThrow(CryptoError);
  });

  it('throws CryptoError on wrong vault key', async () => {
    const encrypted = await encryptVaultMetadata({ name: 'Secret' }, vaultKey);
    const wrongKey = await generateKey();
    await expect(decryptVaultMetadata(encrypted, wrongKey)).rejects.toThrow(CryptoError);
  });
});
