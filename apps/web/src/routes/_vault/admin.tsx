import { createFileRoute } from '@tanstack/react-router';
import { Shield, RefreshCw, Trash2, UserCheck, UserX, Check, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { AdminSettings, AdminUser } from '@blindpass/api-schema';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, ApiError } from '@/lib/api';

export const Route = createFileRoute('/_vault/admin')({
  component: AdminPage,
});

function quotaValue(value: number | null): string {
  return value == null ? '' : String(value);
}

function parseQuota(value: string): number | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : Number(trimmed);
}

type ActiveQuota = {
  userId: string;
  field: 'ownerQuotaOverride' | 'vaultItemQuotaOverride';
  inputValue: string;
  originalValue: number | null;
};

function QuotaCell({
  user,
  field,
  activeQuota,
  setActiveQuota,
  onConfirm,
  onCancel,
  disabled,
}: {
  user: AdminUser;
  field: 'ownerQuotaOverride' | 'vaultItemQuotaOverride';
  activeQuota: ActiveQuota | null;
  setActiveQuota: (q: ActiveQuota | null) => void;
  onConfirm: () => void;
  onCancel: () => void;
  disabled: boolean;
}) {
  const isActive = activeQuota?.userId === user.id && activeQuota?.field === field;
  const serverValue = user[field];
  const inputValue = isActive ? activeQuota!.inputValue : quotaValue(serverValue);
  const isDirty = isActive && parseQuota(activeQuota!.inputValue) !== serverValue;

  return (
    <div className="flex items-center gap-1">
      <Input
        type="number"
        min={1}
        max={100000}
        placeholder="Default"
        value={inputValue}
        onChange={(e) =>
          setActiveQuota({
            userId: user.id,
            field,
            inputValue: e.target.value,
            originalValue: serverValue,
          })
        }
        onBlur={() => {
          if (isActive && !isDirty) setActiveQuota(null);
        }}
        className="w-24"
      />
      {isDirty && (
        <>
          <Button variant="ghost" size="icon-sm" onClick={onConfirm} disabled={disabled}>
            <Check className="size-3.5 text-primary" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onCancel}>
            <X className="size-3.5 text-muted-foreground" />
          </Button>
        </>
      )}
    </div>
  );
}

function AdminPage() {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmingAction, setConfirmingAction] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<AdminUser | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<AdminUser | null>(null);
  const [activeQuota, setActiveQuota] = useState<ActiveQuota | null>(null);
  const [pendingSettings, setPendingSettings] = useState(false);

  const load = useCallback(async (cursor?: string) => {
    setError(null);
    setLoading(true);
    try {
      const [settingsRes, usersRes] = await Promise.all([
        api.getAdminSettings(),
        api.getAdminUsers(cursor, 20),
      ]);
      setSettings(settingsRes.settings);
      setUsers((currentUsers) => (cursor ? [...currentUsers, ...usersRes.users] : usersRes.users));
      setNextCursor(usersRes.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Admin dashboard unavailable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirmSaveSettings() {
    if (!settings) return;
    setConfirmingAction(true);
    setError(null);
    try {
      const res = await api.updateAdminSettings({
        registrationsEnabled: settings.registrationsEnabled,
        defaultOwnerQuota: settings.defaultOwnerQuota,
        defaultVaultItemQuota: settings.defaultVaultItemQuota,
      });
      setSettings(res.settings);
      setPendingSettings(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Settings save failed');
    } finally {
      setConfirmingAction(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setConfirmingAction(true);
    setError(null);
    try {
      await api.deleteAdminUser(pendingDelete.id);
      setPendingDelete(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'User delete failed');
    } finally {
      setConfirmingAction(false);
    }
  }

  async function confirmRevoke() {
    if (!pendingRevoke) return;
    setConfirmingAction(true);
    setError(null);
    try {
      await api.updateAdminUser(pendingRevoke.id, { revoked: !pendingRevoke.revokedAt });
      setPendingRevoke(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'User update failed');
    } finally {
      setConfirmingAction(false);
    }
  }

  async function confirmQuota() {
    if (!activeQuota) return;
    setConfirmingAction(true);
    setError(null);
    try {
      await api.updateAdminUser(activeQuota.userId, {
        [activeQuota.field]: parseQuota(activeQuota.inputValue),
      });
      setActiveQuota(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Quota update failed');
    } finally {
      setConfirmingAction(false);
    }
  }

  function cancelQuota() {
    setActiveQuota(null);
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal">Administration</h1>
            <p className="text-sm text-muted-foreground">Project settings and user access</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {settings && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4" />
                Project settings
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
              <label className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
                <Checkbox
                  checked={settings.registrationsEnabled}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, registrationsEnabled: checked === true })
                  }
                />
                <span className="text-sm font-medium">New registrations</span>
              </label>
              <div className="grid gap-2 lg:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="default-owner-quota">Default owner quota</Label>
                  <Input
                    id="default-owner-quota"
                    type="number"
                    min={1}
                    max={100000}
                    value={settings.defaultOwnerQuota}
                    onChange={(e) =>
                      setSettings({ ...settings, defaultOwnerQuota: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="default-item-quota">Default item quota</Label>
                  <Input
                    id="default-item-quota"
                    type="number"
                    min={1}
                    max={100000}
                    value={settings.defaultVaultItemQuota}
                    onChange={(e) =>
                      setSettings({ ...settings, defaultVaultItemQuota: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <Button onClick={() => setPendingSettings(true)}>Save</Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Users</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Mobile / tablet card list (below lg) */}
            <div className="space-y-2 lg:hidden">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="rounded-xl ring-1 ring-foreground/10 p-4 space-y-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{user.username}</div>
                      {user.isAdmin && (
                        <div className="text-xs text-primary mt-0.5">Admin User</div>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {user.revokedAt ? 'Revoked' : user.verified ? 'Active' : 'Pending'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="text-xs uppercase text-muted-foreground font-medium">
                        Owner quota
                      </div>
                      <QuotaCell
                        user={user}
                        field="ownerQuotaOverride"
                        activeQuota={activeQuota}
                        setActiveQuota={setActiveQuota}
                        onConfirm={() => void confirmQuota()}
                        onCancel={cancelQuota}
                        disabled={confirmingAction}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs uppercase text-muted-foreground font-medium">
                        Item quota
                      </div>
                      <QuotaCell
                        user={user}
                        field="vaultItemQuotaOverride"
                        activeQuota={activeQuota}
                        setActiveQuota={setActiveQuota}
                        onConfirm={() => void confirmQuota()}
                        onCancel={cancelQuota}
                        disabled={confirmingAction}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-11"
                      disabled={user.isAdmin}
                      onClick={() => setPendingRevoke(user)}
                    >
                      {user.revokedAt ? (
                        <UserCheck className="mr-2 h-4 w-4" />
                      ) : (
                        <UserX className="mr-2 h-4 w-4" />
                      )}
                      {user.revokedAt ? 'Restore' : 'Revoke'}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex-1 h-11"
                      disabled={user.isAdmin}
                      onClick={() => setPendingDelete(user)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table (lg and above) */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full min-w-[860px] border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-muted-foreground">
                    <th className="border-b border-border px-2 py-2 font-medium">Username</th>
                    <th className="border-b border-border px-2 py-2 font-medium">Status</th>
                    <th className="border-b border-border px-2 py-2 font-medium">Owner quota</th>
                    <th className="border-b border-border px-2 py-2 font-medium">Item quota</th>
                    <th className="border-b border-border px-2 py-2 text-right font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="border-b border-border px-2 py-3">
                        <div className="font-medium">{user.username}</div>
                        {user.isAdmin && <div className="text-xs text-primary">Admin User</div>}
                      </td>
                      <td className="border-b border-border px-2 py-3">
                        {user.revokedAt ? 'Revoked' : user.verified ? 'Active' : 'Pending'}
                      </td>
                      <td className="border-b border-border px-2 py-3">
                        <QuotaCell
                          user={user}
                          field="ownerQuotaOverride"
                          activeQuota={activeQuota}
                          setActiveQuota={setActiveQuota}
                          onConfirm={() => void confirmQuota()}
                          onCancel={cancelQuota}
                          disabled={confirmingAction}
                        />
                      </td>
                      <td className="border-b border-border px-2 py-3">
                        <QuotaCell
                          user={user}
                          field="vaultItemQuotaOverride"
                          activeQuota={activeQuota}
                          setActiveQuota={setActiveQuota}
                          onConfirm={() => void confirmQuota()}
                          onCancel={cancelQuota}
                          disabled={confirmingAction}
                        />
                      </td>
                      <td className="border-b border-border px-2 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={user.isAdmin}
                            onClick={() => setPendingRevoke(user)}
                          >
                            {user.revokedAt ? (
                              <UserCheck className="mr-2 h-4 w-4" />
                            ) : (
                              <UserX className="mr-2 h-4 w-4" />
                            )}
                            {user.revokedAt ? 'Restore' : 'Revoke'}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={user.isAdmin}
                            onClick={() => setPendingDelete(user)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {nextCursor && (
              <Button variant="outline" onClick={() => void load(nextCursor)} disabled={loading}>
                Load more
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <ResponsiveDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => {
          if (!o) setPendingDelete(null);
        }}
        title="Delete user?"
        description={
          <>
            <strong>{pendingDelete?.username}</strong> will be permanently deleted. This cannot be
            undone.
          </>
        }
        footer={
          <>
            <Button
              variant="destructive"
              onClick={() => void confirmDelete()}
              disabled={confirmingAction}
            >
              {confirmingAction ? 'Deleting…' : 'Delete'}
            </Button>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
          </>
        }
      />

      <ResponsiveDialog
        open={pendingRevoke !== null}
        onOpenChange={(o) => {
          if (!o) setPendingRevoke(null);
        }}
        title={pendingRevoke?.revokedAt ? 'Restore access?' : 'Revoke access?'}
        description={
          pendingRevoke?.revokedAt ? (
            <>
              Restore access for <strong>{pendingRevoke.username}</strong>? They will be able to log
              in again immediately.
            </>
          ) : (
            <>
              Revoke access for <strong>{pendingRevoke?.username}</strong>? They will lose access
              immediately.
            </>
          )
        }
        footer={
          <>
            <Button
              variant={pendingRevoke?.revokedAt ? 'default' : 'destructive'}
              onClick={() => void confirmRevoke()}
              disabled={confirmingAction}
            >
              {confirmingAction
                ? pendingRevoke?.revokedAt
                  ? 'Restoring…'
                  : 'Revoking…'
                : pendingRevoke?.revokedAt
                  ? 'Restore'
                  : 'Revoke'}
            </Button>
            <Button variant="outline" onClick={() => setPendingRevoke(null)}>
              Cancel
            </Button>
          </>
        }
      />

      <ResponsiveDialog
        open={pendingSettings}
        onOpenChange={(o) => {
          if (!o) setPendingSettings(false);
        }}
        title="Save project settings?"
        description="These defaults apply to all users without a quota override."
        footer={
          <>
            <Button onClick={() => void confirmSaveSettings()} disabled={confirmingAction}>
              {confirmingAction ? 'Saving…' : 'Save'}
            </Button>
            <Button variant="outline" onClick={() => setPendingSettings(false)}>
              Cancel
            </Button>
          </>
        }
      />
    </main>
  );
}
