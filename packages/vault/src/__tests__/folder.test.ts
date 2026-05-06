import { describe, it, expect } from 'vitest';
import { generateVaultKey } from '@blindpass/crypto';
import { encryptFolderName, decryptFolderName } from '../folder/encrypt.js';

describe('encryptFolderName / decryptFolderName', () => {
  it('round-trips a folder name', async () => {
    const vaultKey = await generateVaultKey();
    const name = 'Work';
    const blob = await encryptFolderName(name, vaultKey);
    const decrypted = await decryptFolderName(blob, vaultKey);
    expect(decrypted).toBe(name);
  });

  it('round-trips folder name with unicode', async () => {
    const vaultKey = await generateVaultKey();
    const name = 'Personal 🔒';
    const blob = await encryptFolderName(name, vaultKey);
    const decrypted = await decryptFolderName(blob, vaultKey);
    expect(decrypted).toBe(name);
  });

  it('produces different ciphertexts for same name (random nonce)', async () => {
    const vaultKey = await generateVaultKey();
    const blob1 = await encryptFolderName('Work', vaultKey);
    const blob2 = await encryptFolderName('Work', vaultKey);
    expect(blob1.nonce).not.toEqual(blob2.nonce);
  });

  it('throws on wrong key', async () => {
    const vaultKey = await generateVaultKey();
    const wrongKey = await generateVaultKey();
    const blob = await encryptFolderName('Work', vaultKey);
    await expect(decryptFolderName(blob, wrongKey)).rejects.toThrow();
  });
});
