import { describe, it, expect } from 'vitest';
import { validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import {
  generateRecoveryKey,
  encryptRecoveryKey,
  decryptRecoveryKey,
  encryptMasterKeyWithRecovery,
  decryptMasterKeyWithRecovery,
} from './recovery.js';
import { generateKey } from '../lib/random.js';
import { CryptoError } from '../errors.js';

describe('recovery key', () => {
  it('generateRecoveryKey returns a valid BIP39 mnemonic', async () => {
    const mnemonic = await generateRecoveryKey();
    expect(typeof mnemonic).toBe('string');
    expect(validateMnemonic(mnemonic, wordlist)).toBe(true);
  });

  it('generateRecoveryKey returns 24 words', async () => {
    const mnemonic = await generateRecoveryKey();
    expect(mnemonic.split(' ')).toHaveLength(24);
  });

  it('two calls produce different mnemonics', async () => {
    const a = await generateRecoveryKey();
    const b = await generateRecoveryKey();
    expect(a).not.toBe(b);
  });

  it('round-trip encrypt/decrypt returns original mnemonic', async () => {
    const mnemonic = await generateRecoveryKey();
    const masterKey = await generateKey();
    const encrypted = await encryptRecoveryKey(mnemonic, masterKey);
    const decrypted = await decryptRecoveryKey(encrypted, masterKey);
    expect(decrypted).toBe(mnemonic);
  });

  it('decryption with wrong master key throws CryptoError', async () => {
    const mnemonic = await generateRecoveryKey();
    const masterKey = await generateKey();
    const wrongKey = await generateKey();
    const encrypted = await encryptRecoveryKey(mnemonic, masterKey);
    await expect(decryptRecoveryKey(encrypted, wrongKey)).rejects.toThrow(CryptoError);
  });
});

describe('encryptMasterKeyWithRecovery / decryptMasterKeyWithRecovery', () => {
  it('round-trip returns original master key', async () => {
    const masterKey = await generateKey();
    const mnemonic = await generateRecoveryKey();
    const encrypted = await encryptMasterKeyWithRecovery(masterKey, mnemonic);
    const decrypted = await decryptMasterKeyWithRecovery(encrypted, mnemonic);
    expect(decrypted).toEqual(masterKey);
  });

  it('decryption with wrong mnemonic throws CryptoError', async () => {
    const masterKey = await generateKey();
    const mnemonic = await generateRecoveryKey();
    const wrongMnemonic = await generateRecoveryKey();
    const encrypted = await encryptMasterKeyWithRecovery(masterKey, mnemonic);
    await expect(decryptMasterKeyWithRecovery(encrypted, wrongMnemonic)).rejects.toThrow(
      CryptoError,
    );
  });

  it('invalid mnemonic throws', async () => {
    const masterKey = await generateKey();
    const mnemonic = await generateRecoveryKey();
    const encrypted = await encryptMasterKeyWithRecovery(masterKey, mnemonic);
    await expect(decryptMasterKeyWithRecovery(encrypted, 'not valid words')).rejects.toThrow();
  });
});
