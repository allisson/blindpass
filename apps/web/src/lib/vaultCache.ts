export interface CachedVaultItem {
  id: string;
  vaultId: string;
  folderId?: string | null;
  encryptedData: { ciphertext: string; nonce: string };
  encryptedItemKey: { ciphertext: string; nonce: string };
  createdAt: string;
  updatedAt: string;
}

export interface SyncMeta {
  vaultId: string;
  lastSyncedAt: string;
  syncedAt: number;
}

const DB_NAME = 'bp:vault-cache';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      /* c8 ignore next */
      if (!db.objectStoreNames.contains('items')) {
        const store = db.createObjectStore('items', { keyPath: 'id' });
        store.createIndex('vaultId', 'vaultId', { unique: false });
      }
      /* c8 ignore next */
      if (!db.objectStoreNames.contains('syncMeta')) {
        db.createObjectStore('syncMeta', { keyPath: 'vaultId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    /* c8 ignore next */
    req.onerror = () => reject(req.error);
  });
}

export const vaultCache = {
  async getItems(vaultId: string): Promise<CachedVaultItem[]> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('items', 'readonly');
      const req = tx.objectStore('items').index('vaultId').getAll(vaultId);
      req.onsuccess = () => resolve(req.result as CachedVaultItem[]);
      /* c8 ignore next */
      req.onerror = () => reject(req.error);
    });
  },

  async upsertItems(items: CachedVaultItem[]): Promise<void> {
    if (!items.length) return;
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('items', 'readwrite');
      const store = tx.objectStore('items');
      for (const item of items) store.put(item);
      tx.oncomplete = () => resolve();
      /* c8 ignore next */
      tx.onerror = () => reject(tx.error);
    });
  },

  async deleteItems(ids: string[]): Promise<void> {
    if (!ids.length) return;
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('items', 'readwrite');
      const store = tx.objectStore('items');
      for (const id of ids) store.delete(id);
      tx.oncomplete = () => resolve();
      /* c8 ignore next */
      tx.onerror = () => reject(tx.error);
    });
  },

  async getSyncMeta(vaultId: string): Promise<SyncMeta | null> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('syncMeta', 'readonly');
      const req = tx.objectStore('syncMeta').get(vaultId);
      req.onsuccess = () => resolve((req.result as SyncMeta) ?? null);
      /* c8 ignore next */
      req.onerror = () => reject(req.error);
    });
  },

  async setSyncMeta(meta: SyncMeta): Promise<void> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('syncMeta', 'readwrite');
      tx.objectStore('syncMeta').put(meta);
      tx.oncomplete = () => resolve();
      /* c8 ignore next */
      tx.onerror = () => reject(tx.error);
    });
  },

  async clearVault(vaultId: string): Promise<void> {
    const items = await vaultCache.getItems(vaultId);
    await vaultCache.deleteItems(items.map((i) => i.id));
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('syncMeta', 'readwrite');
      tx.objectStore('syncMeta').delete(vaultId);
      tx.oncomplete = () => resolve();
      /* c8 ignore next */
      tx.onerror = () => reject(tx.error);
    });
  },

  async clearAll(): Promise<void> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['items', 'syncMeta'], 'readwrite');
      tx.objectStore('items').clear();
      tx.objectStore('syncMeta').clear();
      tx.oncomplete = () => resolve();
      /* c8 ignore next */
      tx.onerror = () => reject(tx.error);
    });
  },
};
