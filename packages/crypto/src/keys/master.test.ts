import { describe, it, expect } from 'vitest';
import { generateMasterKey, encryptMasterKey, decryptMasterKey } from './master.js';
import { generateKey } from '../lib/random.js';
import { CryptoError } from '../errors.js';

describe('master key', () => {
  it('generateMasterKey returns a Uint8Array', async () => {
    const key = await generateMasterKey();
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.byteLength).toBeGreaterThan(0);
  });

  it('round-trip encrypt/decrypt returns original key', async () => {
    const masterKey = await generateMasterKey();
    const kek = await generateKey();
    const encrypted = await encryptMasterKey(masterKey, kek);
    const decrypted = await decryptMasterKey(encrypted, kek);
    expect(decrypted).toEqual(masterKey);
  });

  it('decryption with wrong KEK throws', async () => {
    const masterKey = await generateMasterKey();
    const kek = await generateKey();
    const wrongKek = await generateKey();
    const encrypted = await encryptMasterKey(masterKey, kek);
    await expect(decryptMasterKey(encrypted, wrongKek)).rejects.toThrow(CryptoError);
  });
});
