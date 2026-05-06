import { Outlet, createRootRoute } from '@tanstack/react-router';
import { ErrorBoundary } from 'react-error-boundary';
import { Toaster } from 'sonner';
import { ErrorFallback } from '@/components/ErrorFallback';
import { useSWUpdate } from '@/hooks/useSWUpdate';

function RootComponent() {
  useSWUpdate();
  return (
    <>
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <Outlet />
      </ErrorBoundary>
      <Toaster richColors position="bottom-right" theme="system" />
    </>
  );
}

export const Route = createRootRoute({ component: RootComponent });
