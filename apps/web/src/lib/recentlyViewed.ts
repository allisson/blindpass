const STORAGE_PREFIX = 'bp:recent:';
const MAX = 10;

function key(vaultId: string): string {
  return STORAGE_PREFIX + vaultId;
}

export function pushRecentlyViewed(vaultId: string, itemId: string): void {
  if (!vaultId || !itemId) return;
  let list: string[];
  try {
    list = JSON.parse(localStorage.getItem(key(vaultId)) ?? '[]');
  } catch {
    list = [];
  }
  const next = [itemId, ...list.filter((id) => id !== itemId)].slice(0, MAX);
  localStorage.setItem(key(vaultId), JSON.stringify(next));
}

export function getRecentlyViewed(vaultId: string): string[] {
  if (!vaultId) return [];
  try {
    return JSON.parse(localStorage.getItem(key(vaultId)) ?? '[]');
  } catch {
    return [];
  }
}

export function clearRecentlyViewed(vaultId: string): void {
  localStorage.removeItem(key(vaultId));
}
