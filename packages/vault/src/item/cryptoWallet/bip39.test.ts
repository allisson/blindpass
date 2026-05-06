import { describe, it, expect } from 'vitest';
import { parseMnemonic, validateWordCount, validateChecksum, suggestWord } from './bip39.js';

// Known-valid 12-word BIP39 test vector (English wordlist, correct checksum)
const VALID_12 =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const VALID_24 =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art';

describe('parseMnemonic', () => {
  it('trims, lowercases, collapses whitespace', () => {
    const { words, canonical } = parseMnemonic('  Abandon  ABANDON  abandon  ');
    expect(words).toEqual(['abandon', 'abandon', 'abandon']);
    expect(canonical).toBe('abandon abandon abandon');
  });
});

describe('validateWordCount', () => {
  it.each([12, 15, 18, 21, 24])('accepts %i words', (n) => {
    expect(validateWordCount(Array(n).fill('abandon'))).toBe(true);
  });

  it.each([13, 16, 25])('rejects %i words', (n) => {
    expect(validateWordCount(Array(n).fill('abandon'))).toBe(false);
  });
});

describe('validateChecksum', () => {
  it('valid for known 12-word test vector', async () => {
    const { words } = parseMnemonic(VALID_12);
    const result = await validateChecksum(words);
    expect(result).toEqual({ valid: true });
  });

  it('valid for known 24-word test vector', async () => {
    const { words } = parseMnemonic(VALID_24);
    const result = await validateChecksum(words);
    expect(result).toEqual({ valid: true });
  });

  it("reports bad_checksum for typo'd last word", async () => {
    const typo = VALID_12.replace('about', 'act');
    const { words } = parseMnemonic(typo);
    const result = await validateChecksum(words);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('bad_checksum');
  });

  it('reports unknown_word for non-wordlist word', async () => {
    const bad = VALID_12.replace('about', 'zzzzz');
    const { words } = parseMnemonic(bad);
    const result = await validateChecksum(words);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('unknown_word');
  });
});

describe('suggestWord', () => {
  it('returns up to 8 completions', async () => {
    const suggestions = await suggestWord('ab');
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.length).toBeLessThanOrEqual(8);
    expect(suggestions.every((w) => w.startsWith('ab'))).toBe(true);
  });

  it('returns empty array for empty prefix', async () => {
    expect(await suggestWord('')).toEqual([]);
  });
});
