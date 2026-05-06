import { describe, it, expect } from 'vitest';
import { generateItemKey, encryptItemKey, decryptItemKey } from './item.js';
import { generateKey } from '../lib/random.js';
import { CryptoError } from '../errors.js';

describe('item key', () => {
  it('generateItemKey returns a Uint8Array', async () => {
    const key = await generateItemKey();
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.byteLength).toBeGreaterThan(0);
  });

  it('round-trip encrypt/decrypt returns original key', async () => {
    const itemKey = await generateItemKey();
    const vaultKey = await generateKey();
    const encrypted = await encryptItemKey(itemKey, vaultKey);
    const decrypted = await decryptItemKey(encrypted, vaultKey);
    expect(decrypted).toEqual(itemKey);
  });

  it('decryption with wrong vault key throws', async () => {
    const itemKey = await generateItemKey();
    const vaultKey = await generateKey();
    const wrongKey = await generateKey();
    const encrypted = await encryptItemKey(itemKey, vaultKey);
    await expect(decryptItemKey(encrypted, wrongKey)).rejects.toThrow(CryptoError);
  });
});
