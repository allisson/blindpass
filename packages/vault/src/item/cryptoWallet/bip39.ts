import { validateMnemonic } from '@scure/bip39';

const VALID_WORD_COUNTS = [12, 15, 18, 21, 24] as const;

let cachedWordlist: string[] | null = null;

async function loadWordlist(): Promise<string[]> {
  if (cachedWordlist) return cachedWordlist;
  const { wordlist } = await import('@scure/bip39/wordlists/english.js');
  cachedWordlist = wordlist;
  return wordlist;
}

export function parseMnemonic(input: string): { words: string[]; canonical: string } {
  const words = input.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return { words, canonical: words.join(' ') };
}

export function validateWordCount(words: string[]): boolean {
  return (VALID_WORD_COUNTS as readonly number[]).includes(words.length);
}

export async function validateChecksum(
  words: string[],
): Promise<{ valid: boolean; reason?: 'unknown_word' | 'bad_checksum' }> {
  const wordlist = await loadWordlist();
  const unknown = words.find((w) => !wordlist.includes(w));
  if (unknown) return { valid: false, reason: 'unknown_word' };
  const valid = validateMnemonic(words.join(' '), wordlist);
  if (!valid) return { valid: false, reason: 'bad_checksum' };
  return { valid: true };
}

export async function suggestWord(prefix: string): Promise<string[]> {
  if (!prefix) return [];
  const wordlist = await loadWordlist();
  return wordlist.filter((w) => w.startsWith(prefix.toLowerCase())).slice(0, 8);
}
