import { describe, it, expect } from 'vitest';
import { generateKeyPair, generateVaultKey, CryptoError } from '@blindpass/crypto';
import { encryptVaultKeyForSharing, decryptSharedVaultKey } from '../index.js';

describe('vault sharing crypto', () => {
  it('round-trips vaultKey through sealBox', async () => {
    const keyPair = await generateKeyPair();
    const vaultKey = await generateVaultKey();

    const sealed = await encryptVaultKeyForSharing(vaultKey, keyPair.publicKey);
    const recovered = await decryptSharedVaultKey(sealed, keyPair);

    expect(recovered).toEqual(vaultKey);
  }, 15000);

  it('throws when decrypting with wrong keypair', async () => {
    const senderKeyPair = await generateKeyPair();
    const wrongKeyPair = await generateKeyPair();
    const vaultKey = await generateVaultKey();

    const sealed = await encryptVaultKeyForSharing(vaultKey, senderKeyPair.publicKey);

    await expect(decryptSharedVaultKey(sealed, wrongKeyPair)).rejects.toThrow(CryptoError);
  }, 15000);
});
