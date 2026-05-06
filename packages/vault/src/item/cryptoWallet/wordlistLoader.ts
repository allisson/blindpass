let cached: string[] | null = null;

export async function loadEnglishWordlist(): Promise<string[]> {
  if (cached) return cached;
  const { wordlist } = await import('@scure/bip39/wordlists/english.js');
  cached = wordlist;
  return wordlist;
}
