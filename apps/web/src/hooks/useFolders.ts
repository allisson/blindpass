import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { encryptFolderName, decryptFolderName } from '@blindpass/vault';
import type { Folder } from '@blindpass/api-schema';
import { api } from '@/lib/api';
import { useKeychain } from '@/components/keychain/KeychainRequired';
import { fromBase64EncryptedValue, toBase64EncryptedValue } from '@/lib/b64';
import { VAULT_ITEMS_KEY, FOLDERS_KEY } from './queryKeys';

export { FOLDERS_KEY };

export type DecryptedFolder = { id: string; name: string; createdAt: string; updatedAt: string };

async function decryptFolder(folder: Folder, vaultKey: Uint8Array): Promise<DecryptedFolder> {
  const name = await decryptFolderName(fromBase64EncryptedValue(folder.encryptedName), vaultKey);
  return { id: folder.id, name, createdAt: folder.createdAt, updatedAt: folder.updatedAt };
}

export function useFolders() {
  const k = useKeychain();
  return useQuery({
    queryKey: FOLDERS_KEY,
    queryFn: async () => {
      const { folders } = await api.listFolders(k.activeVaultId);
      return Promise.all(folders.map((f) => decryptFolder(f, k.vaultKey)));
    },
  });
}

export function useCreateFolder() {
  const qc = useQueryClient();
  const k = useKeychain();
  return useMutation({
    mutationFn: async (name: string) => {
      const encryptedName = await encryptFolderName(name, k.vaultKey);
      const { folder } = await api.createFolder(k.activeVaultId, {
        encryptedName: toBase64EncryptedValue(encryptedName),
      });
      return { ...folder, name };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: FOLDERS_KEY }),
  });
}

export function useRenameFolder() {
  const qc = useQueryClient();
  const k = useKeychain();
  return useMutation({
    mutationFn: async ({ folderId, name }: { folderId: string; name: string }) => {
      const encryptedName = await encryptFolderName(name, k.vaultKey);
      await api.updateFolder(k.activeVaultId, folderId, {
        encryptedName: toBase64EncryptedValue(encryptedName),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: FOLDERS_KEY }),
  });
}

export function useDeleteFolder() {
  const qc = useQueryClient();
  const k = useKeychain();
  return useMutation({
    mutationFn: async (folderId: string) => {
      await api.deleteFolder(k.activeVaultId, folderId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FOLDERS_KEY });
      qc.invalidateQueries({ queryKey: VAULT_ITEMS_KEY });
    },
  });
}
