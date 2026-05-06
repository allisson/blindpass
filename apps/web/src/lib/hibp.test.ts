import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkPasswordBreach, checkBreachesBatch } from './hibp';

const PASSWORD_HELLO_SHA1 = 'AAF4C61DDCC5E8A2DABEDE0F3B482CD9AEA9434D';
const PREFIX = PASSWORD_HELLO_SHA1.slice(0, 5);
const SUFFIX = PASSWORD_HELLO_SHA1.slice(5);

function mockRangeBody(suffix: string, count: number, others: Array<[string, number]> = []) {
  const lines = [...others, [suffix, count] as [string, number]].map(([s, c]) => `${s}:${c}`);
  return lines.join('\n');
}

function mockFetchOk(body: string) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 200 })));
}

function mockFetchStatus(status: number) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status })));
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('checkPasswordBreach', () => {
  it('returns 0 for empty password without calling fetch', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    expect(await checkPasswordBreach('')).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends only the 5-char SHA-1 prefix (k-anonymity) with Add-Padding header', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(new Response(mockRangeBody(SUFFIX, 7), { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    await checkPasswordBreach('hello');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`https://api.pwnedpasswords.com/range/${PREFIX}`);
    expect(url).not.toContain(SUFFIX);
    expect(url).not.toContain('hello');
    expect(init.headers['Add-Padding']).toBe('true');
  });

  it('returns the breach count when suffix matches', async () => {
    mockFetchOk(mockRangeBody(SUFFIX, 42));
    expect(await checkPasswordBreach('hello')).toBe(42);
  });

  it('returns 0 when suffix does not match', async () => {
    mockFetchOk(mockRangeBody('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF', 99));
    expect(await checkPasswordBreach('hello')).toBe(0);
  });

  it('returns 0 when count parses as NaN', async () => {
    mockFetchOk(`${SUFFIX}:notanumber`);
    expect(await checkPasswordBreach('hello')).toBe(0);
  });

  it('throws on non-2xx response', async () => {
    mockFetchStatus(503);
    await expect(checkPasswordBreach('hello')).rejects.toThrow('HIBP request failed: 503');
  });
});

describe('checkBreachesBatch', () => {
  it('returns only items with count > 0', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(mockRangeBody(SUFFIX, 5), { status: 200 })),
    );
    const out = await checkBreachesBatch([
      { id: 'a', password: 'hello' },
      { id: 'b', password: '' },
    ]);
    expect(out).toEqual([{ itemId: 'a', count: 5 }]);
  });

  it('swallows per-item failures and continues', async () => {
    let call = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => {
        call++;
        if (call === 1) return Promise.reject(new Error('network'));
        return Promise.resolve(new Response(mockRangeBody(SUFFIX, 3), { status: 200 }));
      }),
    );
    const out = await checkBreachesBatch([
      { id: 'a', password: 'hello' },
      { id: 'b', password: 'hello' },
    ]);
    expect(out).toEqual([{ itemId: 'b', count: 3 }]);
  });

  it('reports progress for every item', async () => {
    mockFetchOk(mockRangeBody('XX', 0));
    const progress = vi.fn();
    await checkBreachesBatch(
      [
        { id: 'a', password: 'hello' },
        { id: 'b', password: 'hello' },
      ],
      progress,
    );
    expect(progress).toHaveBeenCalledTimes(2);
    expect(progress).toHaveBeenNthCalledWith(1, 1, 2);
    expect(progress).toHaveBeenNthCalledWith(2, 2, 2);
  });

  it('returns empty array for empty input', async () => {
    expect(await checkBreachesBatch([])).toEqual([]);
  });
});
