import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const listeners = new Set<(s: { status: string; lastSyncedAt: null; error: null }) => void>();
let mockState = { status: 'idle' as string, lastSyncedAt: null as null, error: null as null };

vi.mock('@/lib/vaultSync', () => ({
  vaultSync: {
    getState: () => mockState,
    subscribe: (fn: typeof listeners extends Set<infer T> ? T : never) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  },
}));

const { useSyncStatus } = await import('./useSyncStatus');

afterEach(() => {
  listeners.clear();
  mockState = { status: 'idle', lastSyncedAt: null, error: null };
  vi.clearAllMocks();
});

describe('useSyncStatus', () => {
  it('returns initial state from vaultSync', () => {
    const { result } = renderHook(() => useSyncStatus());
    expect(result.current.status).toBe('idle');
  });

  it('re-renders when vaultSync notifies', () => {
    const { result } = renderHook(() => useSyncStatus());
    act(() => {
      mockState = { status: 'syncing', lastSyncedAt: null, error: null };
      listeners.forEach((fn) => fn(mockState));
    });
    expect(result.current.status).toBe('syncing');
  });

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useSyncStatus());
    expect(listeners.size).toBe(1);
    unmount();
    expect(listeners.size).toBe(0);
  });
});
