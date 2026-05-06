import { describe, it, expect } from 'vitest';
import { validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { verificationId } from './verification.js';
import { generateKeyPair } from './asymmetric.js';

describe('verificationId', () => {
  it('returns a valid 24-word BIP39 mnemonic', async () => {
    const { publicKey } = await generateKeyPair();
    const id = await verificationId(publicKey);
    expect(validateMnemonic(id, wordlist)).toBe(true);
    expect(id.split(' ')).toHaveLength(24);
  });

  it('is stable for the same publicKey', async () => {
    const { publicKey } = await generateKeyPair();
    const a = await verificationId(publicKey);
    const b = await verificationId(publicKey);
    expect(a).toBe(b);
  });

  it('differs for different publicKeys', async () => {
    const a = await generateKeyPair();
    const b = await generateKeyPair();
    expect(await verificationId(a.publicKey)).not.toBe(await verificationId(b.publicKey));
  });
});
