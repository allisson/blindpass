import { useEffect, type RefObject } from 'react';

/**
 * Submits the referenced form on Cmd/Ctrl+Enter from anywhere within it.
 */
export function useSubmitShortcut(formRef: RefObject<HTMLFormElement | null>) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Enter') return;
      if (!(e.metaKey || e.ctrlKey)) return;
      const form = formRef.current;
      if (!form) return;
      if (!form.contains(document.activeElement)) return;
      e.preventDefault();
      form.requestSubmit();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [formRef]);
}
