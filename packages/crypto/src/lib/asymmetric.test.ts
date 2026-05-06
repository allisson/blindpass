import { describe, it, expect } from 'vitest';
import { generateKeyPair, sealBox, openSealBox } from './asymmetric.js';
import { CryptoError } from '../errors.js';

describe('asymmetric', () => {
  it('generateKeyPair returns public and private keys', async () => {
    const kp = await generateKeyPair();
    expect(kp.publicKey).toBeInstanceOf(Uint8Array);
    expect(kp.privateKey).toBeInstanceOf(Uint8Array);
    expect(kp.publicKey.byteLength).toBeGreaterThan(0);
    expect(kp.privateKey.byteLength).toBeGreaterThan(0);
  });

  it('two generateKeyPair calls produce different keypairs', async () => {
    const a = await generateKeyPair();
    const b = await generateKeyPair();
    expect(a.publicKey).not.toEqual(b.publicKey);
    expect(a.privateKey).not.toEqual(b.privateKey);
  });

  it('round-trip sealBox/openSealBox returns original plaintext', async () => {
    const kp = await generateKeyPair();
    const plaintext = new TextEncoder().encode('sealed secret');
    const ciphertext = await sealBox(plaintext, kp.publicKey);
    const decrypted = await openSealBox(ciphertext, kp);
    expect(decrypted).toEqual(plaintext);
  });

  it('openSealBox with wrong keypair throws', async () => {
    const kp = await generateKeyPair();
    const wrongKp = await generateKeyPair();
    const plaintext = new TextEncoder().encode('sealed secret');
    const ciphertext = await sealBox(plaintext, kp.publicKey);
    await expect(openSealBox(ciphertext, wrongKp)).rejects.toThrow(CryptoError);
  });
});
