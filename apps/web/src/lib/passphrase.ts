import { wordlist } from '@scure/bip39/wordlists/english.js';

const WORDLIST_SIZE = wordlist.length;

export function generatePassphrase(words = 7, separator = '-'): string {
  if (!Number.isInteger(words) || words < 1) {
    throw new Error('words must be a positive integer');
  }
  return Array.from({ length: words }, () => wordlist[uniformIndex(WORDLIST_SIZE)]).join(separator);
}

export function passphraseEntropyBits(words: number): number {
  return words * Math.log2(WORDLIST_SIZE);
}

function uniformIndex(range: number): number {
  // Rejection sampling against the largest multiple of `range` that fits in 2^32
  // so the resulting index is uniformly distributed.
  const limit = Math.floor(0x1_0000_0000 / range) * range;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % range;
  }
}
