import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { encryptVaultKeyForSharing } from '@blindpass/vault';
import { api } from '@/lib/api';
import { fetchAllPages } from '@/lib/fetchAllPages';
import { session } from '@/lib/session';
import { fromBase64, toBase64 } from '@/lib/b64';

export function useVaultShares(vaultId: string) {
  return useQuery({
    queryKey: ['vaultShares', vaultId],
    queryFn: async () => ({
      shares: await fetchAllPages((cursor) =>
        api.listShares(vaultId, cursor).then((r) => ({ data: r.shares, nextCursor: r.nextCursor })),
      ),
    }),
  });
}

export function useShareVault(vaultId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (receiver: {
      userId: string;
      publicKey: string;
      role: 'viewer' | 'editor';
    }) => {
      const s = session.get();
      if (!s) throw new Error('Not authenticated');
      const entry = s.vaults.get(vaultId);
      if (!entry) throw new Error('Vault not found');
      const sealed = await encryptVaultKeyForSharing(
        entry.vaultKey,
        fromBase64(receiver.publicKey),
      );
      await api.createShare(vaultId, {
        receiverUserId: receiver.userId,
        sealedVaultKey: toBase64(sealed),
        role: receiver.role,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vaultShares', vaultId] });
    },
  });
}

export function useRevokeShare(vaultId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (shareId: string) => api.revokeShare(vaultId, shareId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vaultShares', vaultId] });
    },
  });
}

export function useLeaveShare() {
  return useMutation({
    mutationFn: ({ vaultId, shareId }: { vaultId: string; shareId: string }) =>
      api.revokeShare(vaultId, shareId),
  });
}
