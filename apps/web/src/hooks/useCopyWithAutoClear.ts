import { useCallback, useEffect, useRef } from 'react';

export function useCopyWithAutoClear(ttlMs = 15000) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listenerRef = useRef<(() => void) | null>(null);

  const cancelPending = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (listenerRef.current) {
      document.removeEventListener('visibilitychange', listenerRef.current);
      listenerRef.current = null;
    }
  }, []);

  const copy = useCallback(
    async (text: string) => {
      cancelPending();
      await navigator.clipboard.writeText(text);

      const onVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
          navigator.clipboard.writeText('').catch(() => {});
          cancelPending();
        }
      };
      listenerRef.current = onVisibilityChange;
      document.addEventListener('visibilitychange', onVisibilityChange);

      timerRef.current = setTimeout(() => {
        navigator.clipboard.writeText('').catch(() => {});
        cancelPending();
      }, ttlMs);
    },
    [ttlMs, cancelPending],
  );

  useEffect(() => {
    return cancelPending;
  }, [cancelPending]);

  return copy;
}
