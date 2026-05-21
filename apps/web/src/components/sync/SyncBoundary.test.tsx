import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (m: string) => toastError(m) } }));

const { sessionGetMock, sessionSubscribeMock, notifySessionSubscribers } = vi.hoisted(() => {
  const _subs = new Set<() => void>();
  return {
    sessionGetMock: vi.fn(
      () =>
        ({ activeVaultId: 'v1', keychain: {} }) as {
          activeVaultId: string;
          keychain: Record<string, unknown> | null;
        } | null,
    ),
    sessionSubscribeMock: vi.fn((fn: () => void) => {
      _subs.add(fn);
      return () => _subs.delete(fn);
    }),
    notifySessionSubscribers: () => _subs.forEach((fn) => fn()),
  };
});

vi.mock('@/lib/session', () => ({
  session: { get: sessionGetMock, subscribe: sessionSubscribeMock },
}));

import { SyncBoundary, useSyncBoundary } from './SyncBoundary';
import type { SyncEngine, SyncEvent } from '@/lib/syncEngine';

function makeFakeEngine() {
  const listeners = new Set<(e: SyncEvent) => void>();
  const calls: Array<{ force: boolean }> = [];
  let nextResult: 'success' | 'fail' | 'offline' = 'success';

  const engine: SyncEngine = {
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    async runOnce(opts) {
      calls.push({ force: !!opts?.force });
      for (const l of listeners) l({ type: 'started' });
      await Promise.resolve();
      if (nextResult === 'success') {
        for (const l of listeners) l({ type: 'succeeded', at: 1234 });
      } else if (nextResult === 'offline') {
        for (const l of listeners) l({ type: 'offline' });
      } else {
        for (const l of listeners) l({ type: 'failed', error: new Error('boom') });
      }
    },
  };

  return {
    engine,
    calls,
    setResult(v: 'success' | 'fail' | 'offline') {
      nextResult = v;
    },
  };
}

function makeWrapper(engine: SyncEngine) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: qc },
      createElement(SyncBoundary, { engine, children }),
    );
}

beforeEach(() => {
  toastError.mockClear();
  sessionGetMock.mockReturnValue({ activeVaultId: 'v1', keychain: {} });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SyncBoundary', () => {
  it('runs on mount and transitions idle → syncing → idle on success', async () => {
    const fake = makeFakeEngine();
    const { result } = renderHook(() => useSyncBoundary(), {
      wrapper: makeWrapper(fake.engine),
    });

    await waitFor(() => expect(result.current.phase).toBe('idle'));
    expect(result.current.lastSyncedAt).toBe(1234);
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]).toEqual({ force: false });
  });

  it('transitions to error and shows toast on first failure', async () => {
    const fake = makeFakeEngine();
    fake.setResult('fail');
    const { result } = renderHook(() => useSyncBoundary(), {
      wrapper: makeWrapper(fake.engine),
    });

    await waitFor(() => expect(result.current.phase).toBe('error'));
    expect(result.current.consecutiveFailures).toBe(1);
    expect(result.current.lastError?.message).toBe('boom');
    expect(toastError).toHaveBeenCalledTimes(1);
  });

  it('schedules backoff retry after failure', async () => {
    vi.useFakeTimers();
    const fake = makeFakeEngine();
    fake.setResult('fail');
    renderHook(() => useSyncBoundary(), { wrapper: makeWrapper(fake.engine) });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fake.calls).toHaveLength(1);

    fake.setResult('success');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(fake.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('forceSync clears backoff and runs with force=true', async () => {
    const fake = makeFakeEngine();
    fake.setResult('fail');
    const { result } = renderHook(() => useSyncBoundary(), {
      wrapper: makeWrapper(fake.engine),
    });

    await waitFor(() => expect(result.current.phase).toBe('error'));

    fake.setResult('success');
    await act(async () => {
      await result.current.forceSync();
    });

    const last = fake.calls[fake.calls.length - 1];
    expect(last.force).toBe(true);
    await waitFor(() => expect(result.current.phase).toBe('idle'));
  });

  it('markPending / clearPending update pendingItemIds', async () => {
    const fake = makeFakeEngine();
    const { result } = renderHook(() => useSyncBoundary(), {
      wrapper: makeWrapper(fake.engine),
    });

    await waitFor(() => expect(result.current.phase).toBe('idle'));

    act(() => result.current.markPending('item-1'));
    expect(result.current.pendingItemIds.has('item-1')).toBe(true);

    act(() => result.current.clearPending('item-1'));
    expect(result.current.pendingItemIds.has('item-1')).toBe(false);
  });

  it('does not toast on subsequent consecutive failures', async () => {
    vi.useFakeTimers();
    const fake = makeFakeEngine();
    fake.setResult('fail');
    const { result } = renderHook(() => useSyncBoundary(), {
      wrapper: makeWrapper(fake.engine),
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(toastError).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(result.current.consecutiveFailures).toBeGreaterThanOrEqual(2);
    expect(toastError).toHaveBeenCalledTimes(1);
  });

  it('runs again on window focus', async () => {
    const fake = makeFakeEngine();
    const { result } = renderHook(() => useSyncBoundary(), {
      wrapper: makeWrapper(fake.engine),
    });
    await waitFor(() => expect(result.current.phase).toBe('idle'));
    const before = fake.calls.length;

    await act(async () => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => expect(fake.calls.length).toBeGreaterThan(before));
  });

  it('runs again on online event', async () => {
    const fake = makeFakeEngine();
    const { result } = renderHook(() => useSyncBoundary(), {
      wrapper: makeWrapper(fake.engine),
    });
    await waitFor(() => expect(result.current.phase).toBe('idle'));
    const before = fake.calls.length;

    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => expect(fake.calls.length).toBeGreaterThan(before));
  });

  it('runs with force=true on session change', async () => {
    const fake = makeFakeEngine();
    renderHook(() => useSyncBoundary(), { wrapper: makeWrapper(fake.engine) });
    await waitFor(() => expect(fake.calls.length).toBeGreaterThan(0));
    const before = fake.calls.length;

    await act(async () => {
      notifySessionSubscribers();
    });

    await waitFor(() => expect(fake.calls.length).toBeGreaterThan(before));
    expect(fake.calls[fake.calls.length - 1].force).toBe(true);
  });

  it('useSyncBoundary returns no-op default outside provider', () => {
    const { result } = renderHook(() => useSyncBoundary());
    expect(result.current.phase).toBe('idle');
    expect(() => result.current.markPending('x')).not.toThrow();
    expect(() => result.current.clearPending('x')).not.toThrow();
    void result.current.forceSync();
  });

  it('reports offline phase', async () => {
    const fake = makeFakeEngine();
    fake.setResult('offline');
    const { result } = renderHook(() => useSyncBoundary(), {
      wrapper: makeWrapper(fake.engine),
    });

    await waitFor(() => expect(result.current.phase).toBe('offline'));
  });

  it('skips poll-timer sync when keychain is absent', async () => {
    vi.useFakeTimers();
    const fake = makeFakeEngine();
    renderHook(() => useSyncBoundary(), { wrapper: makeWrapper(fake.engine) });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const initialCalls = fake.calls.length;

    sessionGetMock.mockReturnValue({ activeVaultId: 'v1', keychain: null });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60_000 + 1000);
    });

    expect(fake.calls.length).toBe(initialCalls);
  });

  it('markPending is idempotent for already-pending id', async () => {
    const fake = makeFakeEngine();
    const { result } = renderHook(() => useSyncBoundary(), {
      wrapper: makeWrapper(fake.engine),
    });
    await waitFor(() => expect(result.current.phase).toBe('idle'));

    act(() => result.current.markPending('item-x'));
    const setAfterFirst = result.current.pendingItemIds;

    act(() => result.current.markPending('item-x'));
    expect(result.current.pendingItemIds).toBe(setAfterFirst);
  });

  it('clearPending is no-op for id not in set', async () => {
    const fake = makeFakeEngine();
    const { result } = renderHook(() => useSyncBoundary(), {
      wrapper: makeWrapper(fake.engine),
    });
    await waitFor(() => expect(result.current.phase).toBe('idle'));

    const initial = result.current.pendingItemIds;
    act(() => result.current.clearPending('nonexistent'));
    expect(result.current.pendingItemIds).toBe(initial);
  });

  it('skips polling when session is null on mount', async () => {
    sessionGetMock.mockReturnValue(null);
    const fake = makeFakeEngine();
    const { result } = renderHook(() => useSyncBoundary(), {
      wrapper: makeWrapper(fake.engine),
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(fake.calls).toHaveLength(0);
    expect(result.current.phase).toBe('idle');
  });

  it('skips polling when keychain is null', async () => {
    sessionGetMock.mockReturnValue({ activeVaultId: 'v1', keychain: null });
    const fake = makeFakeEngine();
    renderHook(() => useSyncBoundary(), { wrapper: makeWrapper(fake.engine) });
    await act(async () => {
      await Promise.resolve();
    });
    expect(fake.calls).toHaveLength(0);
  });

  it('forceSync returns immediately when session is null', async () => {
    sessionGetMock.mockReturnValue(null);
    const fake = makeFakeEngine();
    const { result } = renderHook(() => useSyncBoundary(), {
      wrapper: makeWrapper(fake.engine),
    });
    await act(async () => {
      await result.current.forceSync();
    });
    expect(fake.calls).toHaveLength(0);
  });

  it('skips backoff retry when keychain is null', async () => {
    vi.useFakeTimers();
    const fake = makeFakeEngine();
    fake.setResult('fail');
    renderHook(() => useSyncBoundary(), { wrapper: makeWrapper(fake.engine) });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const callsAfterFail = fake.calls.length;

    sessionGetMock.mockReturnValue({ activeVaultId: 'v1', keychain: null });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(fake.calls.length).toBe(callsAfterFail);
  });

  it('skips sync on online event when keychain is null', async () => {
    const fake = makeFakeEngine();
    const { result } = renderHook(() => useSyncBoundary(), {
      wrapper: makeWrapper(fake.engine),
    });
    await waitFor(() => expect(result.current.phase).toBe('idle'));
    const before = fake.calls.length;

    sessionGetMock.mockReturnValue({ activeVaultId: 'v1', keychain: null });
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
    expect(fake.calls.length).toBe(before);
  });

  it('skips sync on visibilitychange when document is hidden', async () => {
    const fake = makeFakeEngine();
    const { result } = renderHook(() => useSyncBoundary(), {
      wrapper: makeWrapper(fake.engine),
    });
    await waitFor(() => expect(result.current.phase).toBe('idle'));
    const before = fake.calls.length;

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    expect(fake.calls.length).toBe(before);
  });
});
