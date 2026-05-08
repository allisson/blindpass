import { useEffect } from 'react';
import { pushRecentlyViewed } from '@/lib/recentlyViewed';
import { session } from '@/lib/session';

export function useRecentlyViewed(itemId: string | undefined): void {
  useEffect(() => {
    const vaultId = session.get()?.activeVaultId;
    if (vaultId && itemId) pushRecentlyViewed(vaultId, itemId);
  }, [itemId]);
}
