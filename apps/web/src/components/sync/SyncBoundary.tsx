import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { session } from '@/lib/session';
import { createDefaultSyncEngine, type SyncEngine } from '@/lib/syncEngine';

export type SyncPhase = 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncBoundaryState {
  phase: SyncPhase;
  lastError: Error | null;
  lastSyncedAt: number | null;
  pendingItemIds: ReadonlySet<string>;
  consecutiveFailures: number;
  forceSync: () => Promise<void>;
  markPending: (id: string) => void;
  clearPending: (id: string) => void;
}

const NOOP_STATE: SyncBoundaryState = {
  phase: 'idle',
  lastError: null,
  lastSyncedAt: null,
  pendingItemIds: new Set(),
  consecutiveFailures: 0,
  forceSync: () => Promise.resolve(),
  markPending: () => {},
  clearPending: () => {},
};

const SyncBoundaryContext = createContext<SyncBoundaryState | null>(null);

export function useSyncBoundary(): SyncBoundaryState {
  return useContext(SyncBoundaryContext) ?? NOOP_STATE;
}

const POLL_INTERVAL_MS = 5 * 60_000;
const BACKOFF_BASE_MS = 2_000;
const BACKOFF_CAP_MS = 60_000;

export interface SyncBoundaryProps {
  engine?: SyncEngine;
  children: ReactNode;
}

export function SyncBoundary({ engine: engineProp, children }: SyncBoundaryProps) {
  const qc = useQueryClient();
  const engine = useMemo(() => engineProp ?? createDefaultSyncEngine(qc), [engineProp, qc]);

  const [phase, setPhase] = useState<SyncPhase>('idle');
  const [lastError, setLastError] = useState<Error | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [pendingItemIds, setPendingItemIds] = useState<Set<string>>(() => new Set());
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);

  const failuresRef = useRef(0);
  const backoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearBackoff = useCallback(() => {
    if (backoffTimerRef.current !== null) {
      clearTimeout(backoffTimerRef.current);
      backoffTimerRef.current = null;
    }
  }, []);

  const trigger = useCallback(
    (force: boolean): Promise<void> => {
      if (!session.get()?.keychain) return Promise.resolve();
      clearBackoff();
      return engine.runOnce({ force });
    },
    [engine, clearBackoff],
  );

  useEffect(() => {
    return engine.subscribe((e) => {
      if (e.type === 'started') {
        setPhase('syncing');
        return;
      }
      if (e.type === 'succeeded') {
        failuresRef.current = 0;
        setConsecutiveFailures(0);
        setLastError(null);
        setLastSyncedAt(e.at);
        setPhase('idle');
        return;
      }
      if (e.type === 'offline') {
        setPhase('offline');
        return;
      }
      // failed
      failuresRef.current += 1;
      const count = failuresRef.current;
      setConsecutiveFailures(count);
      setLastError(e.error);
      setPhase('error');
      if (count === 1) {
        toast.error('Sync failed. Retrying…');
      }
      const delay = Math.min(BACKOFF_BASE_MS * 2 ** (count - 1), BACKOFF_CAP_MS);
      clearBackoff();
      backoffTimerRef.current = setTimeout(() => {
        if (session.get()?.keychain) void engine.runOnce({ force: false });
      }, delay);
    });
  }, [engine, clearBackoff]);

  useEffect(() => {
    if (!session.get()?.keychain) return;

    void trigger(false);

    const pollTimer = setInterval(() => {
      if (session.get()?.keychain) void trigger(false);
    }, POLL_INTERVAL_MS);

    function onVisibility() {
      if (document.visibilityState === 'visible' && session.get()?.keychain) {
        void trigger(false);
      }
    }
    function onOnline() {
      if (session.get()?.keychain) void trigger(false);
    }

    function onVaultSwitch() {
      if (session.get()?.keychain) void trigger(true);
    }

    window.addEventListener('focus', onVisibility);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);
    window.addEventListener('bp:vault-switch', onVaultSwitch);

    return () => {
      clearInterval(pollTimer);
      clearBackoff();
      window.removeEventListener('focus', onVisibility);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('bp:vault-switch', onVaultSwitch);
    };
  }, [trigger, clearBackoff]);

  const markPending = useCallback((id: string) => {
    setPendingItemIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const clearPending = useCallback((id: string) => {
    setPendingItemIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const forceSync = useCallback(() => trigger(true), [trigger]);

  const value = useMemo<SyncBoundaryState>(
    () => ({
      phase,
      lastError,
      lastSyncedAt,
      pendingItemIds,
      consecutiveFailures,
      forceSync,
      markPending,
      clearPending,
    }),
    [
      phase,
      lastError,
      lastSyncedAt,
      pendingItemIds,
      consecutiveFailures,
      forceSync,
      markPending,
      clearPending,
    ],
  );

  return <SyncBoundaryContext.Provider value={value}>{children}</SyncBoundaryContext.Provider>;
}
