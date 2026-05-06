import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { encryptFolderName, decryptFolderName } from '@blindpass/vault';
import type { Folder } from '@blindpass/api-schema';
import { api } from '@/lib/api';
import { session } from '@/lib/session';
import { fromBase64EncryptedValue, toBase64EncryptedValue } from '@/lib/b64';
import { VAULT_ITEMS_KEY, FOLDERS_KEY } from './queryKeys';

export { FOLDERS_KEY };

export type DecryptedFolder = { id: string; name: string; createdAt: string; updatedAt: string };

function getSession() {
  const s = session.get();
  if (!s?.keychain) throw new Error('Not authenticated');
  return s as typeof s & { keychain: NonNullable<typeof s.keychain> };
}

async function decryptFolder(folder: Folder, vaultKey: Uint8Array): Promise<DecryptedFolder> {
  const name = await decryptFolderName(fromBase64EncryptedValue(folder.encryptedName), vaultKey);
  return { id: folder.id, name, createdAt: folder.createdAt, updatedAt: folder.updatedAt };
}

export function useFolders() {
  return useQuery({
    queryKey: FOLDERS_KEY,
    queryFn: async () => {
      const s = getSession();
      const { folders } = await api.listFolders(s.activeVaultId);
      return Promise.all(folders.map((f) => decryptFolder(f, s.keychain.vaultKey)));
    },
  });
}

export function useCreateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const s = getSession();
      const encryptedName = await encryptFolderName(name, s.keychain.vaultKey);
      const { folder } = await api.createFolder(s.activeVaultId, {
        encryptedName: toBase64EncryptedValue(encryptedName),
      });
      return { ...folder, name };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: FOLDERS_KEY }),
  });
}

export function useRenameFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ folderId, name }: { folderId: string; name: string }) => {
      const s = getSession();
      const encryptedName = await encryptFolderName(name, s.keychain.vaultKey);
      await api.updateFolder(s.activeVaultId, folderId, {
        encryptedName: toBase64EncryptedValue(encryptedName),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: FOLDERS_KEY }),
  });
}

export function useDeleteFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (folderId: string) => {
      const s = getSession();
      await api.deleteFolder(s.activeVaultId, folderId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FOLDERS_KEY });
      qc.invalidateQueries({ queryKey: VAULT_ITEMS_KEY });
    },
  });
}
