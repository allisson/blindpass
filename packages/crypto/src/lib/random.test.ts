import { describe, it, expect } from 'vitest';
import { getSodium } from './sodium.js';
import { generateKey, generateNonce, generateSalt } from './random.js';

describe('random', () => {
  it('generateKey returns correct length', async () => {
    const sodium = await getSodium();
    const key = await generateKey();
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.byteLength).toBe(sodium.crypto_secretbox_KEYBYTES);
  });

  it('generateKey returns different values each call', async () => {
    const a = await generateKey();
    const b = await generateKey();
    expect(a).not.toEqual(b);
  });

  it('generateNonce returns correct length', async () => {
    const sodium = await getSodium();
    const nonce = await generateNonce();
    expect(nonce).toBeInstanceOf(Uint8Array);
    expect(nonce.byteLength).toBe(sodium.crypto_secretbox_NONCEBYTES);
  });

  it('generateNonce returns different values each call', async () => {
    const a = await generateNonce();
    const b = await generateNonce();
    expect(a).not.toEqual(b);
  });

  it('generateSalt returns correct length', async () => {
    const sodium = await getSodium();
    const salt = await generateSalt();
    expect(salt).toBeInstanceOf(Uint8Array);
    expect(salt.byteLength).toBe(sodium.crypto_pwhash_SALTBYTES);
  });

  it('generateSalt returns different values each call', async () => {
    const a = await generateSalt();
    const b = await generateSalt();
    expect(a).not.toEqual(b);
  });
});
