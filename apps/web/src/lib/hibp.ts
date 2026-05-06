async function sha1Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-1', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

const HIBP_RANGE_URL = 'https://api.pwnedpasswords.com/range/';

export async function checkPasswordBreach(password: string): Promise<number> {
  if (!password) return 0;
  const hash = await sha1Hex(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  const res = await fetch(HIBP_RANGE_URL + prefix, {
    headers: { 'Add-Padding': 'true' },
  });
  if (!res.ok) throw new Error(`HIBP request failed: ${res.status}`);
  const text = await res.text();
  for (const line of text.split('\n')) {
    const [s, c] = line.trim().split(':');
    if (s === suffix) return parseInt(c, 10) || 0;
  }
  return 0;
}

export type BreachResult = { itemId: string; count: number };

export async function checkBreachesBatch(
  items: Array<{ id: string; password: string }>,
  onProgress?: (done: number, total: number) => void,
): Promise<BreachResult[]> {
  const results: BreachResult[] = [];
  for (let i = 0; i < items.length; i++) {
    const { id, password } = items[i];
    try {
      const count = await checkPasswordBreach(password);
      if (count > 0) results.push({ itemId: id, count });
    } catch {
      /* swallow per-item failures */
    }
    onProgress?.(i + 1, items.length);
  }
  return results;
}
