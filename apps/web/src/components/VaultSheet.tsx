import { useEffect, useState } from 'react';
import { Link, useRouter } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Lock, LogOut, Monitor, Moon, Pencil, Plus, Shield, Sun, Users } from 'lucide-react';
import { Drawer } from 'vaul';
import { toast } from 'sonner';
import { session } from '@/lib/session';
import { extractErrorMessage } from '@/lib/errors';
import { useCreateVault, useRenameVault, useSwitchVault } from '@/hooks/useVault';
import { useLeaveShare } from '@/hooks/useVaultSharing';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';

type Theme = 'light' | 'dark' | 'system';

const THEME_OPTIONS: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
];

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
  onLock: () => void;
  onSignOut: () => void;
  username: string;
  theme: Theme;
  onThemeChange: (t: Theme) => void;
  isAdmin: boolean;
}

export function VaultSheet({
  open,
  onOpenChange,
  onLock,
  onSignOut,
  username,
  theme,
  onThemeChange,
  isAdmin,
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
    if (id === localActiveId) {
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
    setLeaveConfirm(null);
    onOpenChange(false);
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
      toast.success(`Left vault "${vaultName}"`);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to leave vault'));
    }
  }

  return (
    <>
      <Drawer.Root open={open} onOpenChange={onOpenChange}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-40 bg-black/50" />
          <Drawer.Content
            className="fixed bottom-0 inset-x-0 z-50 flex flex-col rounded-t-2xl bg-popover border-t border-border outline-none max-h-[85dvh]"
            aria-describedby={undefined}
          >
            <div className="mx-auto mt-3 mb-1 h-1 w-10 rounded-full bg-border shrink-0" />
            <Drawer.Title className="sr-only">Switch vault</Drawer.Title>

            <div className="overflow-y-auto overscroll-contain flex-1 px-3 pt-2 pb-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold px-1 mb-1.5">
                Vaults
              </p>
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
                        className="flex-1 flex items-center gap-3 px-3 py-3 rounded-xl text-left hover:bg-accent transition-colors touch-manipulation"
                      >
                        <Check
                          className={`w-4 h-4 shrink-0 ${vault.id === localActiveId ? 'text-primary' : 'invisible'}`}
                        />
                        <span className="flex-1 text-sm font-medium truncate">{vault.name}</span>
                        {vault.isShared && (
                          <span
                            title={
                              vault.ownerUsername
                                ? `Shared by ${vault.ownerUsername}`
                                : 'Shared with you'
                            }
                          >
                            <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                          </span>
                        )}
                      </button>
                    )}
                    {renameId !== vault.id && !vault.isShared && (
                      <button
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent active:bg-accent transition-colors touch-manipulation shrink-0"
                        onClick={() => {
                          setRenameId(vault.id);
                          setRenameValue(vault.name);
                        }}
                        aria-label="Rename vault"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {renameId !== vault.id && vault.isShared && vault.shareId && (
                      <button
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-destructive/60 hover:text-destructive hover:bg-destructive/10 active:bg-destructive/10 transition-colors touch-manipulation shrink-0"
                        onClick={() =>
                          setLeaveConfirm({
                            vaultId: vault.id,
                            shareId: vault.shareId!,
                            name: vault.name,
                          })
                        }
                        aria-label="Leave vault"
                      >
                        <LogOut className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {creating ? (
                <div className="flex items-center gap-2 px-1 mt-2">
                  <Input
                    autoFocus
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
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-muted-foreground hover:bg-accent transition-colors mt-1 touch-manipulation"
                  onClick={() => setCreating(true)}
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  <span className="text-sm">New vault</span>
                </button>
              )}
            </div>

            <Separator />
            <div className="px-3 pt-3 pb-1">
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                  <span className="text-xs font-semibold text-primary uppercase">
                    {username.charAt(0).toUpperCase() || '?'}
                  </span>
                </div>
                <div className="flex-1 min-w-0 leading-tight">
                  <span className="block text-sm font-medium text-foreground truncate">
                    {username}
                  </span>
                  <span className="block text-[11px] text-muted-foreground/70">Account</span>
                </div>
              </div>
              <Separator className="mt-1 mb-2" />
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold px-3 mb-1.5">
                Theme
              </p>
              <div
                className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-muted/50 mb-1"
                role="radiogroup"
                aria-label="Theme"
              >
                {THEME_OPTIONS.map(({ value, label, Icon }) => {
                  const active = theme === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => onThemeChange(value)}
                      className={`flex flex-col items-center gap-0.5 py-1.5 rounded text-xs transition-colors touch-manipulation ${
                        active
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  );
                })}
              </div>
              {isAdmin && (
                <Link
                  to="/admin"
                  onClick={() => onOpenChange(false)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-muted-foreground hover:bg-accent active:bg-accent transition-colors touch-manipulation"
                >
                  <Shield className="w-4 h-4 shrink-0" />
                  <span className="text-sm">Admin panel</span>
                </Link>
              )}
            </div>
            <Separator />
            <div
              className="px-3 py-2 flex flex-col gap-0.5"
              style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
            >
              <button
                onClick={() => {
                  onOpenChange(false);
                  onLock();
                }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-muted-foreground hover:bg-accent active:bg-accent transition-colors touch-manipulation"
              >
                <Lock className="w-4 h-4 shrink-0" />
                <span className="text-sm">Lock vault</span>
              </button>
              <button
                onClick={() => {
                  onOpenChange(false);
                  onSignOut();
                }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-destructive/80 hover:bg-destructive/10 active:bg-destructive/10 transition-colors touch-manipulation"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span className="text-sm">Sign out</span>
              </button>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
      <ResponsiveDialog
        open={leaveConfirm !== null}
        onOpenChange={(o) => {
          if (!o) setLeaveConfirm(null);
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
            <Button variant="destructive" onClick={() => void handleLeave()}>
              Leave
            </Button>
            <Button variant="outline" onClick={() => setLeaveConfirm(null)}>
              Cancel
            </Button>
          </>
        }
      />
    </>
  );
}
