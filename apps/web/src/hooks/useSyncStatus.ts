import { useEffect, useState } from 'react';
import { vaultSync, type SyncState } from '@/lib/vaultSync';

export function useSyncStatus(): SyncState {
  const [state, setState] = useState<SyncState>(vaultSync.getState);
  useEffect(() => vaultSync.subscribe(setState), []);
  return state;
}
