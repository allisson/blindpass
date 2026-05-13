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
        <div className="min-h-dvh bg-[#e0dde8] dark:bg-[#111111] flex justify-center items-start">
          <div
            id="app-shell"
            className="w-full max-w-[430px] min-h-dvh bg-background flex flex-col relative overflow-hidden [transform:translateZ(0)]"
          >
            <Outlet />
          </div>
        </div>
      </ErrorBoundary>
      <Toaster richColors position="bottom-center" theme="system" />
    </>
  );
}

export const Route = createRootRoute({ component: RootComponent });
