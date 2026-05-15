import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { encryptVaultMetadata } from '@blindpass/vault';
import { generateKey } from '@blindpass/crypto';
import type { VaultItem } from '@blindpass/vault';
import { api } from '@/lib/api';
import { extractErrorMessage } from '@/lib/errors';
import { fetchAllPages } from '@/lib/fetchAllPages';
import { toast } from 'sonner';
import { session } from '@/lib/session';
import { toBase64EncryptedValue } from '@/lib/b64';
import { vaultCache } from '@/lib/vaultCache';
import { useKeychain } from '@/components/keychain/KeychainRequired';
import { useOptimisticListMutation } from './useOptimisticListMutation';
import { VAULT_ITEMS_KEY, ALL_VAULT_ITEMS_KEY, TRASH_ITEMS_KEY, FOLDERS_KEY } from './queryKeys';

export { VAULT_ITEMS_KEY, ALL_VAULT_ITEMS_KEY, TRASH_ITEMS_KEY };

export type DecryptedItem = VaultItem & {
  id: string;
  folderId?: string | null;
  updatedAt?: string;
  createdAt?: string;
};

export type DecryptedGlobalVaultItem = DecryptedItem & { vaultId: string };

export function useVaultItems() {
  const k = useKeychain();
  return useQuery({
    queryKey: VAULT_ITEMS_KEY,
    queryFn: async () => {
      const cached = await vaultCache.getItems(k.activeVaultId);
      return Promise.all(cached.map((item) => k.decryptItem(item)));
    },
  });
}

export function useAllVaultItems() {
  const k = useKeychain();
  return useQuery({
    queryKey: ALL_VAULT_ITEMS_KEY,
    queryFn: async () => {
      const cached = await vaultCache.getAllItems();
      return Promise.all(
        cached.map(async (item) => {
          const vaultEntry = k.vaults.get(item.vaultId);
          if (!vaultEntry) throw new Error(`Vault not found: ${item.vaultId}`);
          const decrypted = await k.decryptItem(item, vaultEntry.vaultKey);
          return { ...decrypted, vaultId: item.vaultId } as DecryptedGlobalVaultItem;
        }),
      );
    },
  });
}

export function useCreateItem() {
  const k = useKeychain();
  return useOptimisticListMutation<
    { vaultItem: VaultItem; folderId?: string | null },
    { id: string },
    DecryptedItem
  >({
    queryKey: VAULT_ITEMS_KEY,
    errorMessage: 'Failed to save item',
    mutationFn: async ({ vaultItem, folderId }) => {
      const { encryptedData, encryptedItemKey } = await k.encryptItem(vaultItem);
      const { item } = await api.createItem(k.activeVaultId, {
        encryptedData,
        encryptedItemKey,
        folderId: folderId ?? undefined,
      });
      await vaultCache.upsertItems([
        {
          id: item.id,
          vaultId: k.activeVaultId,
          folderId: item.folderId ?? null,
          encryptedData: item.encryptedData,
          encryptedItemKey: item.encryptedItemKey,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        },
      ]);
      return { id: item.id };
    },
    patch: {
      kind: 'append',
      build: ({ vaultItem, folderId }) =>
        ({
          ...vaultItem,
          id: `pending-${Date.now()}`,
          folderId: folderId ?? null,
        }) as DecryptedItem,
    },
  });
}

export function useUpdateItem() {
  const qc = useQueryClient();
  const k = useKeychain();
  return useOptimisticListMutation<{ id: string; vaultItem: VaultItem }, void, DecryptedItem>({
    queryKey: VAULT_ITEMS_KEY,
    errorMessage: 'Failed to update item',
    mutationFn: async ({ id, vaultItem }) => {
      const { encryptedData, encryptedItemKey } = await k.encryptItem(vaultItem);
      await api.updateItem(k.activeVaultId, id, { encryptedData, encryptedItemKey });
    },
    patch: {
      kind: 'updateById',
      id: ({ id }) => id,
      merge: ({ vaultItem }, prev) => ({ ...prev, ...vaultItem }) as DecryptedItem,
    },
    onSuccessExtra: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['itemVersions', id] });
    },
  });
}

export type DecryptedVersion = VaultItem & { versionNum: number; createdAt: string };

export function useItemVersions(itemId: string) {
  const k = useKeychain();
  return useQuery({
    queryKey: ['itemVersions', itemId],
    enabled: !!itemId,
    queryFn: async () => {
      return fetchAllPages((cursor) =>
        api
          .getVersions(k.activeVaultId, itemId, cursor)
          .then((r) => ({ data: r.versions, nextCursor: r.nextCursor })),
      );
    },
  });
}

export function useItemVersion(itemId: string, versionId: string | null) {
  const k = useKeychain();
  return useQuery({
    queryKey: ['itemVersion', itemId, versionId],
    enabled: versionId !== null,
    queryFn: async () => {
      if (!versionId) return null;
      const { version } = await api.getVersion(k.activeVaultId, itemId, versionId);
      const vaultItem = await k.decryptVersion(version);
      return {
        ...vaultItem,
        versionNum: version.versionNum,
        createdAt: version.createdAt,
      } as DecryptedVersion;
    },
  });
}

export function useDeleteItem() {
  const k = useKeychain();
  return useOptimisticListMutation<string, void, DecryptedItem>({
    queryKey: VAULT_ITEMS_KEY,
    errorMessage: 'Failed to delete item',
    mutationFn: async (id) => {
      await api.deleteItem(k.activeVaultId, id);
    },
    patch: { kind: 'removeById', id: (id) => id },
    alsoInvalidate: [TRASH_ITEMS_KEY],
  });
}

export type DecryptedTrashedItem = VaultItem & {
  id: string;
  deletedAt: string;
  vaultId: string;
};

export function useTrashItems() {
  const k = useKeychain();
  return useQuery({
    queryKey: TRASH_ITEMS_KEY,
    queryFn: async () => {
      const items = await fetchAllPages((cursor) =>
        api.getGlobalTrash(cursor).then((r) => ({ data: r.items, nextCursor: r.nextCursor })),
      );
      return Promise.all(
        items.map(async (item) => {
          const vaultEntry = k.vaults.get(item.vaultId);
          if (!vaultEntry) throw new Error(`Vault not found for trash item: ${item.vaultId}`);
          const decrypted = await k.decryptItem(item, vaultEntry.vaultKey);
          return {
            ...decrypted,
            deletedAt: item.deletedAt,
            vaultId: item.vaultId,
          } as DecryptedTrashedItem;
        }),
      );
    },
  });
}

export function useVaultList() {
  const s = session.get();
  return s ? Array.from(s.vaults.entries()).map(([id, v]) => ({ id, name: v.name })) : [];
}

export function useActiveVaultId() {
  return session.get()?.activeVaultId ?? '';
}

export function useMoveItem() {
  const k = useKeychain();
  return useOptimisticListMutation<{ id: string; folderId: string | null }, void, DecryptedItem>({
    queryKey: VAULT_ITEMS_KEY,
    mutationFn: async ({ id, folderId }) => {
      await api.moveItem(k.activeVaultId, id, { folderId });
    },
    patch: {
      kind: 'updateById',
      id: ({ id }) => id,
      merge: ({ folderId }, prev) => ({ ...prev, folderId }),
    },
  });
}

export function useSwitchVault() {
  const qc = useQueryClient();
  return (vaultId: string) => {
    session.switchVault(vaultId);
    qc.removeQueries({ queryKey: VAULT_ITEMS_KEY });
    qc.removeQueries({ queryKey: TRASH_ITEMS_KEY });
    qc.removeQueries({ queryKey: FOLDERS_KEY });
    qc.removeQueries({ predicate: (q) => q.queryKey[0] === 'itemVersions' });
    window.dispatchEvent(new CustomEvent('bp:vault-switch'));
  };
}

export function useCreateVault() {
  const k = useKeychain();
  return useMutation({
    mutationFn: async (name: string) => {
      const vaultKey = await generateKey();
      const encryptedVaultKey = await k.wrapVaultKey(vaultKey);
      const encryptedVaultData = await encryptVaultMetadata({ name }, vaultKey);
      const { vault } = await api.createVault({
        encryptedVaultKey,
        encryptedVaultData: toBase64EncryptedValue(encryptedVaultData),
      });
      const s = session.get();
      if (s) {
        s.vaults.set(vault.id, { vaultKey, name, isShared: false });
        s.activeVaultId = vault.id;
        if (s.keychain) s.keychain.vaultKey = vaultKey;
      }
      window.dispatchEvent(new CustomEvent('bp:vault-switch'));
      return vault;
    },
  });
}

export function useRenameVault() {
  const k = useKeychain();
  return useMutation({
    mutationFn: async ({ vaultId, name }: { vaultId: string; name: string }) => {
      const entry = k.vaults.get(vaultId);
      if (!entry) throw new Error('Vault not found');
      const encryptedVaultData = await encryptVaultMetadata({ name }, entry.vaultKey);
      await api.updateVault(vaultId, {
        encryptedVaultData: toBase64EncryptedValue(encryptedVaultData),
      });
      entry.name = name;
    },
  });
}

export function useRestoreItem() {
  return useOptimisticListMutation<{ id: string; vaultId: string }, void, DecryptedTrashedItem>({
    queryKey: TRASH_ITEMS_KEY,
    errorMessage: 'Failed to restore item',
    mutationFn: async ({ id, vaultId }) => {
      await api.restoreItem(vaultId, id);
    },
    patch: { kind: 'removeById', id: ({ id }) => id },
    alsoInvalidate: [VAULT_ITEMS_KEY],
  });
}

export function usePurgeItem() {
  return useOptimisticListMutation<{ id: string; vaultId: string }, void, DecryptedTrashedItem>({
    queryKey: TRASH_ITEMS_KEY,
    errorMessage: 'Failed to permanently delete item',
    mutationFn: async ({ id, vaultId }) => {
      await api.purgeItem(vaultId, id);
    },
    patch: { kind: 'removeById', id: ({ id }) => id },
    syncOnSuccess: false,
  });
}

export function useEmptyTrash() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.emptyGlobalTrash(),
    onError: (_err) => {
      toast.error(extractErrorMessage(_err, 'Failed to empty trash'));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: TRASH_ITEMS_KEY }),
  });
}
