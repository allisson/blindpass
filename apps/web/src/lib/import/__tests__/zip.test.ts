import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { readZip, ZipError } from '../zip';

describe('readZip', () => {
  it('round-trips a simple archive', async () => {
    const bytes = zipSync({
      'hello.txt': strToU8('hello world'),
      'nested/inner.csv': strToU8('a,b\n1,2'),
    });
    const entries = await readZip(bytes);
    expect(entries.size).toBe(2);
    expect(new TextDecoder().decode(entries.get('hello.txt'))).toBe('hello world');
    expect(new TextDecoder().decode(entries.get('nested/inner.csv'))).toBe('a,b\n1,2');
  });

  it('rejects malformed input as ZipError', async () => {
    const bogus = new Uint8Array([0, 1, 2, 3, 4]);
    await expect(readZip(bogus)).rejects.toBeInstanceOf(ZipError);
  });
});
