import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import { extractErrorMessage } from '@/lib/errors';
import { useSyncBoundary } from '@/components/sync/SyncBoundary';

export type Patch<TItem extends { id: string }, TVars> =
  | { kind: 'append'; build: (vars: TVars) => TItem }
  | {
      kind: 'updateById';
      id: (vars: TVars) => string;
      merge: (vars: TVars, prev: TItem) => TItem;
    }
  | { kind: 'removeById'; id: (vars: TVars) => string };

export interface OptimisticListMutationOptions<TVars, TData, TItem extends { id: string }> {
  queryKey: QueryKey;
  mutationFn: (vars: TVars) => Promise<TData>;
  patch: Patch<TItem, TVars>;
  errorMessage?: string;
  /** Defaults to true. Pass false to skip post-success vaultSync trigger. */
  syncOnSuccess?: boolean;
  /** Extra query keys to invalidate after success (queryKey itself is always invalidated). */
  alsoInvalidate?: QueryKey[];
  /** Extra side-effect after the standard onSuccess pipeline. */
  onSuccessExtra?: (data: TData, vars: TVars) => void;
}

export interface OptimisticMutationCtx<TItem> {
  previous: TItem[] | undefined;
  pendingId: string | null;
}

function applyPatch<TItem extends { id: string }, TVars>(
  patch: Patch<TItem, TVars>,
  vars: TVars,
  list: TItem[] | undefined,
): { next: TItem[] | undefined; pendingId: string | null } {
  if (patch.kind === 'append') {
    const item = patch.build(vars);
    return { next: [...(list ?? []), item], pendingId: item.id };
  }
  if (patch.kind === 'updateById') {
    const id = patch.id(vars);
    return {
      next: list?.map((item) => (item.id === id ? patch.merge(vars, item) : item)),
      pendingId: id,
    };
  }
  const id = patch.id(vars);
  return { next: list?.filter((item) => item.id !== id), pendingId: id };
}

export function useOptimisticListMutation<TVars, TData, TItem extends { id: string }>(
  opts: OptimisticListMutationOptions<TVars, TData, TItem>,
) {
  const qc = useQueryClient();
  const sync = useSyncBoundary();
  const {
    queryKey,
    mutationFn,
    patch,
    errorMessage,
    syncOnSuccess = true,
    alsoInvalidate,
    onSuccessExtra,
  } = opts;

  return useMutation<TData, Error, TVars, OptimisticMutationCtx<TItem>>({
    mutationFn,
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData<TItem[]>(queryKey);
      const { next, pendingId } = applyPatch(patch, vars, previous);
      qc.setQueryData<TItem[]>(queryKey, next);
      if (pendingId) sync.markPending(pendingId);
      return { previous, pendingId };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKey, ctx.previous);
      if (errorMessage) toast.error(extractErrorMessage(err, errorMessage));
    },
    onSettled: (_data, _err, _vars, ctx) => {
      if (ctx?.pendingId) sync.clearPending(ctx.pendingId);
    },
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey });
      if (alsoInvalidate) {
        for (const k of alsoInvalidate) qc.invalidateQueries({ queryKey: k });
      }
      onSuccessExtra?.(data, vars);
      if (syncOnSuccess) void sync.forceSync();
    },
  });
}
