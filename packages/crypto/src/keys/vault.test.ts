import { describe, it, expect } from 'vitest';
import { generateVaultKey, encryptVaultKey, decryptVaultKey } from './vault.js';
import { generateKey } from '../lib/random.js';
import { CryptoError } from '../errors.js';

describe('vault key', () => {
  it('generateVaultKey returns a Uint8Array', async () => {
    const key = await generateVaultKey();
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.byteLength).toBeGreaterThan(0);
  });

  it('round-trip encrypt/decrypt returns original key', async () => {
    const vaultKey = await generateVaultKey();
    const masterKey = await generateKey();
    const encrypted = await encryptVaultKey(vaultKey, masterKey);
    const decrypted = await decryptVaultKey(encrypted, masterKey);
    expect(decrypted).toEqual(vaultKey);
  });

  it('decryption with wrong master key throws', async () => {
    const vaultKey = await generateVaultKey();
    const masterKey = await generateKey();
    const wrongKey = await generateKey();
    const encrypted = await encryptVaultKey(vaultKey, masterKey);
    await expect(decryptVaultKey(encrypted, wrongKey)).rejects.toThrow(CryptoError);
  });
});
