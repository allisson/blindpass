import type { FallbackProps } from 'react-error-boundary';
import { session } from '@/lib/session';

export function ErrorFallback({ error }: FallbackProps) {
  const message = error instanceof Error ? error.message : 'An unexpected error occurred';

  function handleReturn() {
    session.clear();
    window.location.href = '/login';
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        <button
          onClick={handleReturn}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Return to vault
        </button>
      </div>
    </div>
  );
}
