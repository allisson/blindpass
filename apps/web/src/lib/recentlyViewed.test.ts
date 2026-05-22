import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  pushRecentlyViewed,
  getRecentlyViewed,
  clearRecentlyViewed,
  subscribeRecentlyViewed,
} from './recentlyViewed';

beforeEach(() => {
  localStorage.clear();
});

describe('pushRecentlyViewed', () => {
  it('prepends the item id', () => {
    pushRecentlyViewed('v1', 'a');
    pushRecentlyViewed('v1', 'b');
    expect(getRecentlyViewed('v1')).toEqual(['b', 'a']);
  });

  it('deduplicates existing ids by moving them to the front', () => {
    pushRecentlyViewed('v1', 'a');
    pushRecentlyViewed('v1', 'b');
    pushRecentlyViewed('v1', 'a');
    expect(getRecentlyViewed('v1')).toEqual(['a', 'b']);
  });

  it('caps the list at 10 entries', () => {
    for (let i = 0; i < 15; i++) pushRecentlyViewed('v1', `id-${i}`);
    const list = getRecentlyViewed('v1');
    expect(list).toHaveLength(10);
    expect(list[0]).toBe('id-14');
    expect(list[9]).toBe('id-5');
  });

  it('is scoped per vault', () => {
    pushRecentlyViewed('v1', 'a');
    pushRecentlyViewed('v2', 'b');
    expect(getRecentlyViewed('v1')).toEqual(['a']);
    expect(getRecentlyViewed('v2')).toEqual(['b']);
  });

  it('is a no-op when vaultId or itemId is empty', () => {
    pushRecentlyViewed('', 'a');
    pushRecentlyViewed('v1', '');
    expect(getRecentlyViewed('v1')).toEqual([]);
  });

  it('recovers from corrupt JSON in storage', () => {
    localStorage.setItem('bp:recent:v1', '{not json');
    pushRecentlyViewed('v1', 'a');
    expect(getRecentlyViewed('v1')).toEqual(['a']);
  });
});

describe('getRecentlyViewed', () => {
  it('returns empty array when key is missing', () => {
    expect(getRecentlyViewed('v1')).toEqual([]);
  });

  it('returns empty array for empty vaultId', () => {
    expect(getRecentlyViewed('')).toEqual([]);
  });

  it('returns empty array on corrupt JSON', () => {
    localStorage.setItem('bp:recent:v1', '{bad');
    expect(getRecentlyViewed('v1')).toEqual([]);
  });
});

describe('clearRecentlyViewed', () => {
  it('removes the per-vault key', () => {
    pushRecentlyViewed('v1', 'a');
    clearRecentlyViewed('v1');
    expect(getRecentlyViewed('v1')).toEqual([]);
    expect(localStorage.getItem('bp:recent:v1')).toBeNull();
  });
});

describe('subscribeRecentlyViewed', () => {
  it('notifies on push and clear, and unsubscribes cleanly', () => {
    const fn = vi.fn();
    const unsub = subscribeRecentlyViewed(fn);
    pushRecentlyViewed('v1', 'a');
    clearRecentlyViewed('v1');
    expect(fn).toHaveBeenCalledTimes(2);
    unsub();
    pushRecentlyViewed('v1', 'b');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not notify when push is a no-op (empty vaultId or itemId)', () => {
    const fn = vi.fn();
    const unsub = subscribeRecentlyViewed(fn);
    pushRecentlyViewed('', 'a');
    pushRecentlyViewed('v1', '');
    expect(fn).not.toHaveBeenCalled();
    unsub();
  });
});
