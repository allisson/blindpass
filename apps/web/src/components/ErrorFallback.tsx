import type { FallbackProps } from 'react-error-boundary';
import { ShieldAlert } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { session } from '@/lib/session';
import { extractErrorMessage } from '@/lib/errors';

export function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const message = extractErrorMessage(error, 'An unexpected error occurred');
  const isAuthError = error instanceof ApiError && error.status === 401;

  function handleSignOut() {
    session.clear();
    window.location.href = '/login';
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <ShieldAlert className="h-6 w-6 text-destructive" />
        </div>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-base font-semibold text-foreground">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        {isAuthError ? (
          <button
            onClick={handleSignOut}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Sign in again
          </button>
        ) : (
          <button
            onClick={resetErrorBoundary}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
