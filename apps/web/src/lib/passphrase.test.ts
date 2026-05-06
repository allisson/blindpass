import { describe, it, expect } from 'vitest';
import { generatePassphrase, passphraseEntropyBits } from './passphrase';
import { wordlist } from '@scure/bip39/wordlists/english.js';

const WORDSET = new Set(wordlist);

describe('generatePassphrase', () => {
  it('returns the requested number of words separated by "-"', () => {
    const phrase = generatePassphrase(7);
    const parts = phrase.split('-');
    expect(parts).toHaveLength(7);
    for (const w of parts) expect(WORDSET.has(w)).toBe(true);
  });

  it('honours custom word counts and separators', () => {
    const phrase = generatePassphrase(4, ' ');
    const parts = phrase.split(' ');
    expect(parts).toHaveLength(4);
    for (const w of parts) expect(WORDSET.has(w)).toBe(true);
  });

  it('rejects non-positive integer word counts', () => {
    expect(() => generatePassphrase(0)).toThrow();
    expect(() => generatePassphrase(-1)).toThrow();
    expect(() => generatePassphrase(1.5)).toThrow();
  });

  it('produces distinct outputs across calls (no Math.random)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) seen.add(generatePassphrase(7));
    expect(seen.size).toBe(20);
  });

  it('samples from across the wordlist', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      for (const w of generatePassphrase(7).split('-')) seen.add(w);
    }
    expect(seen.size).toBeGreaterThan(50);
  });
});

describe('passphraseEntropyBits', () => {
  it('matches log2(2048) per word', () => {
    expect(passphraseEntropyBits(1)).toBeCloseTo(11, 5);
    expect(passphraseEntropyBits(7)).toBeCloseTo(77, 5);
  });
});
