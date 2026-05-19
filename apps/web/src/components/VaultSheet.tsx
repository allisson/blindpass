import { useEffect, useState } from 'react';
import { useRouter } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Layers, LogOut, Pencil, Plus, UserPlus, Users, X } from 'lucide-react';
import { Drawer } from 'vaul';
import { toast } from 'sonner';
import { session } from '@/lib/session';
import { extractErrorMessage } from '@/lib/errors';
import { vaultColor } from '@/lib/vaultColor';
import { useCreateVault, useRenameVault, useSwitchVault } from '@/hooks/useVault';
import { useLeaveShare } from '@/hooks/useVaultSharing';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { ShareVaultModal } from '@/components/vault/ShareVaultModal';

interface VaultEntry {
  id: string;
  name: string;
  isShared: boolean;
  ownerUsername?: string;
  shareId?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAllVaults: boolean;
  allVaultsItemCount: number;
  onSelectAll: () => void;
}

export function VaultSheet({
  open,
  onOpenChange,
  isAllVaults,
  allVaultsItemCount,
  onSelectAll,
}: Props) {
  const [localActiveId, setLocalActiveId] = useState(() => session.get()?.activeVaultId ?? '');
  const [localVaults, setLocalVaults] = useState<VaultEntry[]>(() => {
    const s = session.get();
    if (!s) return [];
    return Array.from(s.vaults.entries()).map(([id, v]) => ({
      id,
      name: v.name,
      isShared: v.isShared,
      ownerUsername: v.ownerUsername,
      shareId: v.shareId,
    }));
  });
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState('');
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [leaveConfirm, setLeaveConfirm] = useState<{
    vaultId: string;
    shareId: string;
    name: string;
  } | null>(null);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [shareVaultId, setShareVaultId] = useState<string | null>(null);

  const switchVault = useSwitchVault();
  const createVault = useCreateVault();
  const renameVault = useRenameVault();
  const leaveShare = useLeaveShare();
  const router = useRouter();
  const qc = useQueryClient();

  useEffect(() => {
    function onSwitch() {
      const s = session.get();
      if (!s) return;
      setLocalActiveId(s.activeVaultId);
      setLocalVaults(
        Array.from(s.vaults.entries()).map(([id, v]) => ({
          id,
          name: v.name,
          isShared: v.isShared,
          ownerUsername: v.ownerUsername,
          shareId: v.shareId,
        })),
      );
    }
    window.addEventListener('bp:vault-switch', onSwitch);
    return () => window.removeEventListener('bp:vault-switch', onSwitch);
  }, []);

  function handleSwitch(id: string) {
    if (!isAllVaults && id === localActiveId) {
      onOpenChange(false);
      return;
    }
    switchVault(id);
    setLocalActiveId(id);
    qc.removeQueries({ queryKey: ['items'] });
    qc.removeQueries({ queryKey: ['folders'] });
    onOpenChange(false);
    window.dispatchEvent(new CustomEvent('bp:vault-switch'));
  }

  async function commitCreate() {
    const trimmed = createName.trim();
    if (!trimmed) {
      setCreating(false);
      return;
    }
    try {
      const vault = await createVault.mutateAsync(trimmed);
      const s = session.get();
      if (s) {
        setLocalVaults(
          Array.from(s.vaults.entries()).map(([id, v]) => ({
            id,
            name: v.name,
            isShared: v.isShared,
            ownerUsername: v.ownerUsername,
            shareId: v.shareId,
          })),
        );
        setLocalActiveId(vault.id);
        void router.navigate({ to: '/', search: { vaultId: vault.id } });
        window.dispatchEvent(new CustomEvent('bp:vault-switch'));
      }
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to create vault'));
    }
    setCreateName('');
    setCreating(false);
    onOpenChange(false);
  }

  async function commitRename(vaultId: string) {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenameId(null);
      return;
    }
    try {
      await renameVault.mutateAsync({ vaultId, name: trimmed });
      setLocalVaults((prev) => prev.map((v) => (v.id === vaultId ? { ...v, name: trimmed } : v)));
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to rename vault'));
    }
    setRenameId(null);
  }

  async function handleLeave() {
    if (!leaveConfirm) return;
    const { vaultId, shareId, name: vaultName } = leaveConfirm;
    setLeaveError(null);
    try {
      await leaveShare.mutateAsync({ vaultId, shareId });
      const s = session.get();
      if (s) {
        const entry = s.vaults.get(vaultId);
        if (entry) entry.vaultKey.fill(0);
        s.vaults.delete(vaultId);
        if (s.activeVaultId === vaultId) {
          const firstId = [...s.vaults.keys()][0];
          if (firstId) {
            s.activeVaultId = firstId;
            const first = s.vaults.get(firstId);
            if (s.keychain && first) s.keychain.vaultKey = first.vaultKey;
            setLocalActiveId(firstId);
          }
        }
      }
      setLocalVaults((prev) => prev.filter((v) => v.id !== vaultId));
      window.dispatchEvent(new CustomEvent('bp:vault-switch'));
      setLeaveConfirm(null);
      toast.success(`Left vault "${vaultName}"`);
    } catch (err) {
      setLeaveError(extractErrorMessage(err, 'Failed to leave vault'));
    }
  }

  return (
    <>
      <Drawer.Root open={open} onOpenChange={onOpenChange}>
        <Drawer.Portal container={document.getElementById('app-shell')}>
          <Drawer.Overlay className="fixed inset-0 z-40 bg-black/50" />
          <Drawer.Content
            className="fixed bottom-0 inset-x-0 z-50 flex flex-col rounded-t-2xl bg-popover border-t border-border outline-none max-h-[85dvh]"
            aria-describedby={undefined}
          >
            <div className="mx-auto mt-3 mb-1 h-1 w-10 rounded-full bg-border shrink-0" />

            <div className="flex items-center justify-between px-4 py-3 shrink-0">
              <Drawer.Title className="text-base font-semibold">Vaults</Drawer.Title>
              <button
                onClick={() => onOpenChange(false)}
                className="w-10 h-10 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors touch-manipulation"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto overscroll-contain flex-1 px-3 pb-2">
              {/* All vaults row */}
              <button
                onClick={() => {
                  onSelectAll();
                  onOpenChange(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left hover:bg-accent transition-colors touch-manipulation mb-0.5"
              >
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Layers className="w-4 h-4 text-primary" />
                </div>
                <span className="flex-1 min-w-0 flex flex-col leading-tight">
                  <span className="text-sm font-medium">All vaults</span>
                  <span className="text-[11px] text-muted-foreground/70">
                    {allVaultsItemCount} items
                  </span>
                </span>
                <Check
                  className={`w-4 h-4 shrink-0 ${isAllVaults ? 'text-primary' : 'invisible'}`}
                />
              </button>

              <div className="h-px bg-border mx-3 my-1" />

              <div className="space-y-0.5">
                {localVaults.map((vault) => (
                  <div key={vault.id} className="flex items-center gap-1">
                    {renameId === vault.id ? (
                      <Input
                        autoFocus
                        className="flex-1 h-10 text-sm"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void commitRename(vault.id);
                          if (e.key === 'Escape') setRenameId(null);
                        }}
                        onBlur={() => void commitRename(vault.id)}
                      />
                    ) : (
                      <button
                        onClick={() => handleSwitch(vault.id)}
                        className="flex-1 flex items-center gap-3 px-3 py-3 rounded-xl text-left hover:bg-accent transition-colors touch-manipulation min-w-0"
                      >
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white text-sm font-bold"
                          style={{ backgroundColor: vaultColor(vault.id) }}
                          aria-hidden="true"
                        >
                          {vault.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="flex-1 min-w-0 flex flex-col leading-tight">
                          <span className="text-sm font-medium truncate">{vault.name}</span>
                          {vault.isShared && vault.ownerUsername && (
                            <span className="text-[11px] text-muted-foreground/70 truncate">
                              Shared by {vault.ownerUsername}
                            </span>
                          )}
                        </span>
                        {vault.isShared && (
                          <span
                            title={
                              vault.ownerUsername
                                ? `Shared by ${vault.ownerUsername}`
                                : 'Shared with you'
                            }
                          >
                            <Users className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                          </span>
                        )}
                        <Check
                          className={`w-4 h-4 shrink-0 ${!isAllVaults && vault.id === localActiveId ? 'text-primary' : 'invisible'}`}
                        />
                      </button>
                    )}
                    {renameId !== vault.id && !vault.isShared && (
                      <>
                        <button
                          data-testid="rename-vault-button"
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent active:bg-accent transition-colors touch-manipulation shrink-0"
                          onClick={() => {
                            setRenameId(vault.id);
                            setRenameValue(vault.name);
                          }}
                          title="Rename vault"
                          aria-label="Rename vault"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          data-testid="share-vault-button"
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent active:bg-accent transition-colors touch-manipulation shrink-0"
                          onClick={() => {
                            setShareVaultId(vault.id);
                            onOpenChange(false);
                          }}
                          title="Share vault"
                          aria-label="Share vault"
                        >
                          <UserPlus className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {renameId !== vault.id && vault.isShared && vault.shareId && (
                      <button
                        data-testid="leave-vault-button"
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-destructive/60 hover:text-destructive hover:bg-destructive/10 active:bg-destructive/10 transition-colors touch-manipulation shrink-0"
                        onClick={() => {
                          setLeaveError(null);
                          setLeaveConfirm({
                            vaultId: vault.id,
                            shareId: vault.shareId!,
                            name: vault.name,
                          });
                          onOpenChange(false);
                        }}
                        title="Leave vault"
                        aria-label="Leave vault"
                      >
                        <LogOut className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div
              className="px-3 pt-2 pb-4 border-t border-border"
              style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
            >
              {creating ? (
                <div className="flex items-center gap-2">
                  <Input
                    autoFocus
                    data-testid="new-vault-name-input"
                    placeholder="Vault name…"
                    className="flex-1 h-10 text-sm"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    onFocus={(e) =>
                      e.target.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void commitCreate();
                      if (e.key === 'Escape') {
                        setCreating(false);
                        setCreateName('');
                      }
                    }}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    data-testid="confirm-create-vault-button"
                    className="h-10 w-10 shrink-0"
                    onClick={() => void commitCreate()}
                    disabled={createVault.isPending}
                    aria-label="Confirm create vault"
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <button
                  data-testid="new-vault-button"
                  className="w-full flex items-center justify-center gap-2 bg-primary text-white h-11 rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors touch-manipulation"
                  onClick={() => setCreating(true)}
                >
                  <Plus className="w-4 h-4" />
                  Create vault
                </button>
              )}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      {leaveConfirm && (
        <ResponsiveDialog
          open={leaveConfirm !== null}
          onOpenChange={(o) => {
            if (!o && !leaveShare.isPending) {
              setLeaveConfirm(null);
              setLeaveError(null);
            }
          }}
          title="Leave vault"
          description={
            <>
              Leave &ldquo;{leaveConfirm?.name}&rdquo;? You will lose access and the owner will be
              notified.
            </>
          }
          footer={
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setLeaveConfirm(null);
                  setLeaveError(null);
                }}
                disabled={leaveShare.isPending}
              >
                Cancel
              </Button>
              <Button
                data-testid="confirm-leave-button"
                variant="destructive"
                onClick={() => void handleLeave()}
                disabled={leaveShare.isPending}
              >
                {leaveShare.isPending ? 'Leaving…' : 'Leave'}
              </Button>
            </>
          }
        >
          {leaveError && (
            <p className="text-xs text-destructive" role="alert">
              {leaveError}
            </p>
          )}
        </ResponsiveDialog>
      )}
      {shareVaultId && (
        <ShareVaultModal
          vaultId={shareVaultId}
          open={shareVaultId !== null}
          onOpenChange={(o) => {
            if (!o) setShareVaultId(null);
          }}
        />
      )}
    </>
  );
}
