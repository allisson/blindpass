import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';

const { toastErrorMock, syncMock } = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
  syncMock: {
    markPending: vi.fn(),
    clearPending: vi.fn(),
    forceSync: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('sonner', () => ({ toast: { error: toastErrorMock } }));

vi.mock('@/components/sync/SyncBoundary', () => ({
  useSyncBoundary: () => ({
    phase: 'idle',
    lastError: null,
    lastSyncedAt: null,
    pendingItemIds: new Set(),
    consecutiveFailures: 0,
    ...syncMock,
  }),
}));

import { useOptimisticListMutation } from './useOptimisticListMutation';

interface Item {
  id: string;
  title: string;
}

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    qc,
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: qc }, children),
  };
}

const KEY = ['items'] as const;

beforeEach(() => {
  toastErrorMock.mockReset();
  syncMock.markPending.mockReset();
  syncMock.clearPending.mockReset();
  syncMock.forceSync.mockReset();
  syncMock.forceSync.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useOptimisticListMutation', () => {
  describe('append', () => {
    it('appends item, marks pending, calls forceSync on success', async () => {
      const { qc, wrapper } = makeWrapper();
      qc.setQueryData<Item[]>(KEY, [{ id: 'a', title: 'A' }]);
      const mutationFn = vi.fn().mockResolvedValue({ ok: true });

      const { result } = renderHook(
        () =>
          useOptimisticListMutation<{ title: string }, { ok: true }, Item>({
            queryKey: KEY,
            mutationFn,
            patch: {
              kind: 'append',
              build: ({ title }) => ({ id: 'pending-1', title }),
            },
          }),
        { wrapper },
      );

      result.current.mutate({ title: 'New' });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mutationFn).toHaveBeenCalledWith({ title: 'New' }, expect.anything());
      expect(syncMock.markPending).toHaveBeenCalledWith('pending-1');
      expect(syncMock.clearPending).toHaveBeenCalledWith('pending-1');
      expect(syncMock.forceSync).toHaveBeenCalled();
    });
  });

  describe('updateById', () => {
    it('merges item by id', async () => {
      const { qc, wrapper } = makeWrapper();
      qc.setQueryData<Item[]>(KEY, [
        { id: 'a', title: 'A' },
        { id: 'b', title: 'B' },
      ]);
      const mutationFn = vi.fn().mockResolvedValue(undefined);

      const { result } = renderHook(
        () =>
          useOptimisticListMutation<{ id: string; title: string }, void, Item>({
            queryKey: KEY,
            mutationFn,
            patch: {
              kind: 'updateById',
              id: ({ id }) => id,
              merge: ({ title }, prev) => ({ ...prev, title }),
            },
          }),
        { wrapper },
      );

      result.current.mutate({ id: 'b', title: 'B-new' });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const list = qc.getQueryData<Item[]>(KEY);
      expect(list?.find((i) => i.id === 'b')?.title).toBe('B-new');
    });
  });

  describe('removeById', () => {
    it('removes item, rolls back on error, shows toast', async () => {
      const { qc, wrapper } = makeWrapper();
      const initial: Item[] = [
        { id: 'a', title: 'A' },
        { id: 'b', title: 'B' },
      ];
      qc.setQueryData<Item[]>(KEY, initial);
      const mutationFn = vi.fn().mockRejectedValue(new Error('boom'));

      const { result } = renderHook(
        () =>
          useOptimisticListMutation<string, void, Item>({
            queryKey: KEY,
            mutationFn,
            errorMessage: 'Failed',
            patch: { kind: 'removeById', id: (id) => id },
          }),
        { wrapper },
      );

      result.current.mutate('a');
      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(qc.getQueryData<Item[]>(KEY)).toEqual(initial);
      expect(toastErrorMock).toHaveBeenCalledOnce();
      expect(syncMock.clearPending).toHaveBeenCalledWith('a');
    });
  });

  it('honors syncOnSuccess: false', async () => {
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData<Item[]>(KEY, []);

    const { result } = renderHook(
      () =>
        useOptimisticListMutation<string, void, Item>({
          queryKey: KEY,
          mutationFn: vi.fn().mockResolvedValue(undefined),
          patch: { kind: 'removeById', id: (id) => id },
          syncOnSuccess: false,
        }),
      { wrapper },
    );

    result.current.mutate('x');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(syncMock.forceSync).not.toHaveBeenCalled();
  });

  it('skips toast when no errorMessage provided', async () => {
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData<Item[]>(KEY, []);

    const { result } = renderHook(
      () =>
        useOptimisticListMutation<string, void, Item>({
          queryKey: KEY,
          mutationFn: vi.fn().mockRejectedValue(new Error('x')),
          patch: { kind: 'removeById', id: (id) => id },
        }),
      { wrapper },
    );

    result.current.mutate('x');
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it('invalidates alsoInvalidate keys on success', async () => {
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData<Item[]>(KEY, []);
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(
      () =>
        useOptimisticListMutation<string, void, Item>({
          queryKey: KEY,
          mutationFn: vi.fn().mockResolvedValue(undefined),
          patch: { kind: 'removeById', id: (id) => id },
          alsoInvalidate: [['extra']],
        }),
      { wrapper },
    );

    result.current.mutate('x');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: KEY });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['extra'] });
  });
});
