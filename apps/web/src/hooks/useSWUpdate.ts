import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';

export function useSWUpdate() {
  const { needRefresh, updateServiceWorker } = useRegisterSW();
  const [needsUpdate] = needRefresh;

  useEffect(() => {
    if (!needsUpdate) return;

    toast('New version available', {
      duration: Infinity,
      action: {
        label: 'Reload',
        onClick: () => void updateServiceWorker(true),
      },
    });
  }, [needsUpdate, updateServiceWorker]);
}
