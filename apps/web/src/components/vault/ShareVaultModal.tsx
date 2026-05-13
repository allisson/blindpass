import { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { verificationId } from '@blindpass/crypto';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { extractErrorMessage } from '@/lib/errors';
import { fromBase64 } from '@/lib/b64';
import { session } from '@/lib/session';
import { useVaultShares, useShareVault, useRevokeShare } from '@/hooks/useVaultSharing';

interface Props {
  vaultId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PendingShare {
  username: string;
  userId: string;
  publicKey: string;
  verificationId: string;
}

function isValidUsername(value: string) {
  return /^[a-z0-9_]{3,32}$/.test(value.trim());
}

export function ShareVaultModal({ vaultId, open, onOpenChange }: Props) {
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<'viewer' | 'editor'>('viewer');
  const [shareError, setShareError] = useState<string | null>(null);
  const [pendingShare, setPendingShare] = useState<PendingShare | null>(null);
  const [resolvingShare, setResolvingShare] = useState(false);
  const [pendingRevokes, setPendingRevokes] = useState<Set<string>>(new Set());
  const [confirmRevoke, setConfirmRevoke] = useState<{
    shareId: string;
    receiverUsername: string;
  } | null>(null);

  const { data, isLoading } = useVaultShares(vaultId);
  const shareVault = useShareVault(vaultId);
  const revokeShare = useRevokeShare(vaultId);

  const vaultName = session.get()?.vaults.get(vaultId)?.name;

  async function resolveReceiver(target: string) {
    setShareError(null);
    setResolvingShare(true);
    try {
      const { userId, publicKey } = await api.getUserByUsername(target);
      const id = await verificationId(fromBase64(publicKey));
      setPendingShare({ username: target, userId, publicKey, verificationId: id });
    } catch (err) {
      const msg = extractErrorMessage(err, 'Lookup failed');
      setShareError(
        msg.toLowerCase().includes('not found')
          ? 'No BlindPass account found for this username.'
          : msg,
      );
    } finally {
      setResolvingShare(false);
    }
  }

  async function handleShare() {
    if (!pendingShare) return;
    setShareError(null);
    const target = pendingShare.username;
    try {
      await shareVault.mutateAsync({
        userId: pendingShare.userId,
        publicKey: pendingShare.publicKey,
        role,
      });
      setUsername('');
      setPendingShare(null);
      toast.success(`Shared with ${target}`);
    } catch (err) {
      setShareError(extractErrorMessage(err, 'Share failed'));
    }
  }

  async function handleRevoke(shareId: string) {
    setPendingRevokes((prev) => new Set(prev).add(shareId));
    setConfirmRevoke(null);
    try {
      await revokeShare.mutateAsync(shareId);
      toast.success('Access revoked');
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to revoke access'));
    } finally {
      setPendingRevokes((prev) => {
        const next = new Set(prev);
        next.delete(shareId);
        return next;
      });
    }
  }

  return (
    <>
      <Dialog
        open={pendingShare !== null}
        onOpenChange={(o) => {
          if (!o) setPendingShare(null);
        }}
      >
        <DialogContent showCloseButton={false} container={document.getElementById('app-shell')}>
          <DialogHeader>
            <DialogTitle>Verify recipient identity</DialogTitle>
            <DialogDescription>
              Confirm this is the right person before sharing your vault key with them. Compare the
              24-word verification ID below to the one shown in their app under{' '}
              <span className="font-medium text-foreground">Settings → Verification ID</span>.
            </DialogDescription>
          </DialogHeader>
          {pendingShare && (
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Username
                </p>
                <p className="text-sm font-medium">{pendingShare.username}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Verification ID
                </p>
                <p className="font-mono text-xs leading-relaxed rounded-md border border-border bg-muted/40 p-3 break-words">
                  {pendingShare.verificationId}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button onClick={() => void handleShare()} disabled={shareVault.isPending}>
              {shareVault.isPending ? 'Sharing…' : 'Share'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={confirmRevoke !== null}
        onOpenChange={(o) => {
          if (!o) setConfirmRevoke(null);
        }}
      >
        <DialogContent showCloseButton={false} container={document.getElementById('app-shell')}>
          <DialogHeader>
            <DialogTitle>Revoke access</DialogTitle>
            <DialogDescription>
              Revoke access for {confirmRevoke?.receiverUsername}? They will lose access
              immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button
              variant="destructive"
              onClick={() => confirmRevoke && void handleRevoke(confirmRevoke.shareId)}
            >
              Revoke
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md" container={document.getElementById('app-shell')}>
          <DialogHeader>
            <DialogTitle>{vaultName ? `Share "${vaultName}"` : 'Share vault'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="share-username">Share with (username)</Label>
                <Input
                  id="share-username"
                  placeholder="colleague_handle"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (shareError) setShareError(null);
                  }}
                  onKeyDown={(e) =>
                    e.key === 'Enter' &&
                    isValidUsername(username) &&
                    void resolveReceiver(username.trim())
                  }
                  disabled={resolvingShare || shareVault.isPending}
                />
              </div>

              <div className="space-y-1.5">
                <Label id="share-role-label">Role</Label>
                <div
                  role="radiogroup"
                  aria-labelledby="share-role-label"
                  className="flex gap-1.5 rounded-lg bg-muted p-1"
                >
                  {(['viewer', 'editor'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      role="radio"
                      aria-checked={role === r}
                      onClick={() => setRole(r)}
                      disabled={resolvingShare || shareVault.isPending}
                      className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                        role === r
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                className="w-full"
                onClick={() => void resolveReceiver(username.trim())}
                disabled={!isValidUsername(username) || resolvingShare || shareVault.isPending}
                size="sm"
              >
                {resolvingShare ? 'Looking up…' : 'Continue'}
              </Button>

              {shareError && (
                <p className="text-xs text-destructive" role="alert">
                  {shareError}
                </p>
              )}
            </div>

            {isLoading ? (
              <div className="space-y-1">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 rounded-md" />
                ))}
              </div>
            ) : data && data.shares.length > 0 ? (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Shared with
                </p>
                <ul className="space-y-1">
                  {data.shares.map((share) => {
                    const isRevoking = pendingRevokes.has(share.id);
                    return (
                      <li
                        key={share.id}
                        className={`flex items-center justify-between text-sm py-1 px-2 rounded-md hover:bg-muted/50 transition-opacity ${
                          isRevoking ? 'opacity-60' : ''
                        }`}
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="truncate">{share.receiverUsername}</span>
                          <span className="text-[10px] text-muted-foreground capitalize">
                            {share.role}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            setConfirmRevoke({
                              shareId: share.id,
                              receiverUsername: share.receiverUsername,
                            })
                          }
                          disabled={isRevoking}
                          aria-label={`Revoke access for ${share.receiverUsername}`}
                        >
                          {isRevoking ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-border/60 px-3 py-4 text-center">
                <p className="text-xs font-medium text-foreground">Not shared yet</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Enter a username above to give someone access.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
