import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { decryptVaultItem, encryptVaultItem, encryptVaultMetadata } from '@blindpass/vault';
import { generateKey, encryptSymmetric, decryptSymmetric } from '@blindpass/crypto';
import type { VaultItem } from '@blindpass/vault';
import type { EncryptedGlobalTrashedItem, EncryptedVaultItem } from '@blindpass/api-schema';
import { api } from '@/lib/api';
import { extractErrorMessage } from '@/lib/errors';
import { fetchAllPages } from '@/lib/fetchAllPages';
import { toast } from 'sonner';
import { session } from '@/lib/session';
import { fromBase64EncryptedValue, toBase64EncryptedValue } from '@/lib/b64';
import { vaultCache } from '@/lib/vaultCache';
import { vaultSync } from '@/lib/vaultSync';
import { VAULT_ITEMS_KEY, TRASH_ITEMS_KEY, FOLDERS_KEY } from './queryKeys';

export { VAULT_ITEMS_KEY, TRASH_ITEMS_KEY };

export type DecryptedItem = VaultItem & {
  id: string;
  folderId?: string | null;
  updatedAt?: string;
  createdAt?: string;
};

function getSession() {
  const s = session.get();
  if (!s?.keychain) throw new Error('Not authenticated');
  return s as typeof s & { keychain: NonNullable<typeof s.keychain> };
}

async function decryptItem(item: EncryptedVaultItem, vaultKey: Uint8Array): Promise<DecryptedItem> {
  const itemKey = await decryptSymmetric(fromBase64EncryptedValue(item.encryptedItemKey), vaultKey);
  const vaultItem = await decryptVaultItem(fromBase64EncryptedValue(item.encryptedData), itemKey);
  itemKey.fill(0);
  return {
    ...vaultItem,
    id: item.id,
    folderId: item.folderId,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export function useVaultItems() {
  return useQuery({
    queryKey: VAULT_ITEMS_KEY,
    queryFn: async () => {
      const s = getSession();

      if (!navigator.onLine) {
        const cached = await vaultCache.getItems(s.activeVaultId);
        return Promise.all(
          cached.map((item) => decryptItem(item as EncryptedVaultItem, s.keychain.vaultKey)),
        );
      }

      const items = await fetchAllPages((cursor) =>
        api
          .getItems(s.activeVaultId, cursor)
          .then((r) => ({ data: r.items, nextCursor: r.nextCursor })),
      );

      void vaultCache.upsertItems(
        items.map((item) => ({
          id: item.id,
          vaultId: s.activeVaultId,
          folderId: item.folderId,
          encryptedData: item.encryptedData,
          encryptedItemKey: item.encryptedItemKey,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        })),
      );

      return Promise.all(items.map((item) => decryptItem(item, s.keychain.vaultKey)));
    },
  });
}

export function useCreateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      vaultItem,
      folderId,
    }: {
      vaultItem: VaultItem;
      folderId?: string | null;
    }) => {
      const s = getSession();
      const itemKey = await generateKey();
      const encryptedData = await encryptVaultItem(vaultItem, itemKey);
      const encryptedItemKey = await encryptSymmetric(itemKey, s.keychain.vaultKey);
      itemKey.fill(0);
      const { item } = await api.createItem(s.activeVaultId, {
        encryptedData: toBase64EncryptedValue(encryptedData),
        encryptedItemKey: toBase64EncryptedValue(encryptedItemKey),
        folderId: folderId ?? undefined,
      });
      return item.id;
    },
    onMutate: async ({ vaultItem, folderId }) => {
      await qc.cancelQueries({ queryKey: VAULT_ITEMS_KEY });
      const previous = qc.getQueryData<DecryptedItem[]>(VAULT_ITEMS_KEY);
      const tempId = `pending-${Date.now()}`;
      qc.setQueryData<DecryptedItem[]>(VAULT_ITEMS_KEY, (old) => [
        ...(old ?? []),
        { ...vaultItem, id: tempId, folderId: folderId ?? null },
      ]);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(VAULT_ITEMS_KEY, ctx.previous);
      toast.error(extractErrorMessage(_err, 'Failed to save item'));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: VAULT_ITEMS_KEY }),
  });
}

export function useUpdateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, vaultItem }: { id: string; vaultItem: VaultItem }) => {
      const s = getSession();
      const itemKey = await generateKey();
      const encryptedData = await encryptVaultItem(vaultItem, itemKey);
      const encryptedItemKey = await encryptSymmetric(itemKey, s.keychain.vaultKey);
      itemKey.fill(0);
      await api.updateItem(s.activeVaultId, id, {
        encryptedData: toBase64EncryptedValue(encryptedData),
        encryptedItemKey: toBase64EncryptedValue(encryptedItemKey),
      });
    },
    onMutate: async ({ id, vaultItem }) => {
      await qc.cancelQueries({ queryKey: VAULT_ITEMS_KEY });
      const previous = qc.getQueryData<DecryptedItem[]>(VAULT_ITEMS_KEY);
      qc.setQueryData<DecryptedItem[]>(VAULT_ITEMS_KEY, (old) =>
        old?.map((item) => (item.id === id ? { ...item, ...vaultItem } : item)),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(VAULT_ITEMS_KEY, ctx.previous);
      toast.error(extractErrorMessage(_err, 'Failed to update item'));
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: VAULT_ITEMS_KEY });
      qc.invalidateQueries({ queryKey: ['itemVersions', id] });
    },
  });
}

export type DecryptedVersion = VaultItem & { versionNum: number; createdAt: string };

export function useItemVersions(itemId: string) {
  return useQuery({
    queryKey: ['itemVersions', itemId],
    enabled: !!itemId,
    queryFn: async () => {
      const s = getSession();
      return fetchAllPages((cursor) =>
        api
          .getVersions(s.activeVaultId, itemId, cursor)
          .then((r) => ({ data: r.versions, nextCursor: r.nextCursor })),
      );
    },
  });
}

export function useItemVersion(itemId: string, versionId: string | null) {
  return useQuery({
    queryKey: ['itemVersion', itemId, versionId],
    enabled: versionId !== null,
    queryFn: async () => {
      if (!versionId) return null;
      const s = getSession();
      const { version } = await api.getVersion(s.activeVaultId, itemId, versionId);
      const itemKey = await decryptSymmetric(
        fromBase64EncryptedValue(version.encryptedItemKey),
        s.keychain.vaultKey,
      );
      const vaultItem = await decryptVaultItem(
        fromBase64EncryptedValue(version.encryptedData),
        itemKey,
      );
      itemKey.fill(0);
      return {
        ...vaultItem,
        versionNum: version.versionNum,
        createdAt: version.createdAt,
      } as DecryptedVersion;
    },
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const s = getSession();
      await api.deleteItem(s.activeVaultId, id);
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: VAULT_ITEMS_KEY });
      const previous = qc.getQueryData<DecryptedItem[]>(VAULT_ITEMS_KEY);
      qc.setQueryData<DecryptedItem[]>(VAULT_ITEMS_KEY, (old) =>
        old?.filter((item) => item.id !== id),
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(VAULT_ITEMS_KEY, ctx.previous);
      toast.error(extractErrorMessage(_err, 'Failed to delete item'));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: TRASH_ITEMS_KEY }),
  });
}

export type DecryptedTrashedItem = VaultItem & {
  id: string;
  deletedAt: string;
  vaultId: string;
};

async function decryptTrashedItem(
  item: EncryptedGlobalTrashedItem,
  vaultKey: Uint8Array,
): Promise<DecryptedTrashedItem> {
  const itemKey = await decryptSymmetric(fromBase64EncryptedValue(item.encryptedItemKey), vaultKey);
  const vaultItem = await decryptVaultItem(fromBase64EncryptedValue(item.encryptedData), itemKey);
  itemKey.fill(0);
  return { ...vaultItem, id: item.id, deletedAt: item.deletedAt, vaultId: item.vaultId };
}

export function useTrashItems() {
  return useQuery({
    queryKey: TRASH_ITEMS_KEY,
    queryFn: async () => {
      const s = getSession();
      const items = await fetchAllPages((cursor) =>
        api.getGlobalTrash(cursor).then((r) => ({ data: r.items, nextCursor: r.nextCursor })),
      );
      return Promise.all(
        items.map((item) => {
          const vaultEntry = s.vaults.get(item.vaultId);
          if (!vaultEntry) throw new Error(`Vault not found for trash item: ${item.vaultId}`);
          return decryptTrashedItem(item, vaultEntry.vaultKey);
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
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, folderId }: { id: string; folderId: string | null }) => {
      const s = getSession();
      await api.moveItem(s.activeVaultId, id, { folderId });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: VAULT_ITEMS_KEY }),
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
    vaultSync.startPolling(vaultId, qc);
  };
}

export function useCreateVault() {
  return useMutation({
    mutationFn: async (name: string) => {
      const s = getSession();
      const vaultKey = await generateKey();
      const encryptedVaultKey = await encryptSymmetric(vaultKey, s.keychain.masterKey);
      const encryptedVaultData = await encryptVaultMetadata({ name }, vaultKey);
      const { vault } = await api.createVault({
        encryptedVaultKey: toBase64EncryptedValue(encryptedVaultKey),
        encryptedVaultData: toBase64EncryptedValue(encryptedVaultData),
      });
      s.vaults.set(vault.id, { vaultKey, name, isShared: false });
      s.activeVaultId = vault.id;
      s.keychain.vaultKey = vaultKey;
      window.dispatchEvent(new CustomEvent('bp:vault-switch'));
      return vault;
    },
  });
}

export function useRenameVault() {
  return useMutation({
    mutationFn: async ({ vaultId, name }: { vaultId: string; name: string }) => {
      const s = getSession();
      const entry = s.vaults.get(vaultId);
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
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, vaultId }: { id: string; vaultId: string }) => {
      await api.restoreItem(vaultId, id);
    },
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: TRASH_ITEMS_KEY });
      const previous = qc.getQueryData<DecryptedTrashedItem[]>(TRASH_ITEMS_KEY);
      qc.setQueryData<DecryptedTrashedItem[]>(TRASH_ITEMS_KEY, (old) =>
        old?.filter((item) => item.id !== id),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(TRASH_ITEMS_KEY, ctx.previous);
      toast.error(extractErrorMessage(_err, 'Failed to restore item'));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: VAULT_ITEMS_KEY });
      qc.invalidateQueries({ queryKey: TRASH_ITEMS_KEY });
    },
  });
}

export function usePurgeItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, vaultId }: { id: string; vaultId: string }) => {
      await api.purgeItem(vaultId, id);
    },
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: TRASH_ITEMS_KEY });
      const previous = qc.getQueryData<DecryptedTrashedItem[]>(TRASH_ITEMS_KEY);
      qc.setQueryData<DecryptedTrashedItem[]>(TRASH_ITEMS_KEY, (old) =>
        old?.filter((item) => item.id !== id),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(TRASH_ITEMS_KEY, ctx.previous);
      toast.error(extractErrorMessage(_err, 'Failed to permanently delete item'));
    },
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
