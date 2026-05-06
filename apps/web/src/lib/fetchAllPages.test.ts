import { describe, it, expect, vi } from 'vitest';
import { fetchAllPages } from './fetchAllPages';

describe('fetchAllPages', () => {
  it('returns data from a single page', async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: ['a', 'b'], nextCursor: null });
    const result = await fetchAllPages(fetcher);
    expect(result).toEqual(['a', 'b']);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(undefined);
  });

  it('concatenates data across multiple pages', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ data: ['a'], nextCursor: 'cursor1' })
      .mockResolvedValueOnce({ data: ['b', 'c'], nextCursor: null });
    const result = await fetchAllPages(fetcher);
    expect(result).toEqual(['a', 'b', 'c']);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenNthCalledWith(2, 'cursor1');
  });

  it('stops at 200 pages and returns what was collected', async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: ['x'], nextCursor: 'next' });
    const result = await fetchAllPages(fetcher);
    expect(result).toHaveLength(200);
    expect(fetcher).toHaveBeenCalledTimes(200);
  });

  it('returns empty array when first page has no data', async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: [], nextCursor: null });
    const result = await fetchAllPages(fetcher);
    expect(result).toEqual([]);
  });
});
