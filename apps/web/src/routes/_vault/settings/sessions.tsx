import { createFileRoute } from '@tanstack/react-router';
import { AlertCircle, LogOut } from 'lucide-react';
import { SettingsPage } from '@/components/settings/SettingsPage';
import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@blindpass/api-schema';
import { Button } from '@/components/ui/button';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export const Route = createFileRoute('/_vault/settings/sessions')({
  component: SessionsPage,
});

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function parseUserAgent(ua: string | null): string {
  if (!ua) return 'Unknown device';
  const browser = (() => {
    if (/Edg\//.test(ua)) return 'Edge';
    if (/OPR\/|Opera/.test(ua)) return 'Opera';
    if (/Firefox\//.test(ua)) return 'Firefox';
    if (/Chrome\//.test(ua)) return 'Chrome';
    if (/Safari\//.test(ua)) return 'Safari';
    return 'Unknown browser';
  })();
  const os = (() => {
    if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
    if (/Android/.test(ua)) return 'Android';
    if (/Mac OS X|Macintosh/.test(ua)) return 'macOS';
    if (/Windows NT/.test(ua)) return 'Windows';
    if (/CrOS/.test(ua)) return 'ChromeOS';
    if (/Linux/.test(ua)) return 'Linux';
    return 'Unknown OS';
  })();
  if (browser === 'Unknown browser' && os === 'Unknown OS') return 'Unknown device';
  return `${browser} on ${os}`;
}

function sortSessions(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => {
    if (a.isCurrent && !b.isCurrent) return -1;
    if (!a.isCurrent && b.isCurrent) return 1;
    return Date.parse(b.lastUsedAt) - Date.parse(a.lastUsedAt);
  });
}

function SessionsList() {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [error, setError] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [showRevokeAll, setShowRevokeAll] = useState(false);

  const load = useCallback(() => {
    setError(false);
    setSessions(null);
    api
      .getSessions()
      .then((res) => setSessions(sortSessions(res.sessions)))
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRevoke(id: string) {
    setRevoking(id);
    try {
      await api.deleteSession(id);
      setSessions((prev) => (prev ? prev.filter((s) => s.id !== id) : prev));
    } catch {
      toast.error('Failed to revoke session');
    } finally {
      setRevoking(null);
    }
  }

  async function handleRevokeAll() {
    setRevokingAll(true);
    try {
      await api.deleteAllOtherSessions();
      const res = await api.getSessions();
      setSessions(sortSessions(res.sessions));
      toast.success('All other sessions signed out');
    } catch {
      toast.error('Failed to sign out other sessions');
    } finally {
      setRevokingAll(false);
    }
  }

  async function confirmRevoke(): Promise<void> {
    if (!confirmRevokeId) return;
    await handleRevoke(confirmRevokeId);
    setConfirmRevokeId(null);
  }

  async function confirmRevokeAll(): Promise<void> {
    await handleRevokeAll();
    setShowRevokeAll(false);
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-destructive/70 text-sm py-3">
        <AlertCircle className="w-4 h-4 shrink-0" />
        Failed to load sessions.
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={load}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (!sessions) {
    return (
      <div className="divide-y divide-border">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="py-3">
            <Skeleton className="h-4 w-48 rounded-none" />
            <Skeleton className="h-3 w-32 mt-2 rounded-none" />
          </div>
        ))}
      </div>
    );
  }

  const hasOthers = sessions.some((s) => !s.isCurrent);

  return (
    <div>
      <ul className="divide-y divide-border">
        {sessions.map((s) => (
          <li
            key={s.id}
            data-testid="session-row"
            className="flex items-start justify-between gap-4 py-3"
          >
            <div className="min-w-0">
              <p
                className="flex items-center gap-2 text-sm font-medium text-foreground truncate"
                title={s.userAgent ?? undefined}
              >
                {s.isCurrent && (
                  <>
                    <span
                      aria-hidden="true"
                      className="inline-block w-1.5 h-1.5 rounded-full shrink-0 bg-accent-teal"
                      style={{ boxShadow: '0 0 6px var(--accent-teal)' }}
                    />
                    <span className="sr-only">Current device. </span>
                  </>
                )}
                <span className="truncate">{parseUserAgent(s.userAgent)}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Last active{' '}
                <time
                  dateTime={s.lastUsedAt}
                  className="font-mono tracking-[0.06em] text-foreground/80"
                >
                  {formatTimestamp(s.lastUsedAt)}
                </time>
              </p>
            </div>
            {!s.isCurrent && (
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 h-7 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                disabled={revoking === s.id}
                onClick={() => setConfirmRevokeId(s.id)}
              >
                <LogOut className="w-3 h-3" />
                Revoke
              </Button>
            )}
          </li>
        ))}
      </ul>

      {hasOthers && (
        <div className="flex justify-end mt-6">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            disabled={revokingAll}
            onClick={() => setShowRevokeAll(true)}
          >
            <LogOut className="w-3 h-3" />
            {revokingAll ? 'Signing out…' : 'Sign out all other devices'}
          </Button>
        </div>
      )}

      <ResponsiveDialog
        open={confirmRevokeId !== null}
        onOpenChange={(open) => !open && setConfirmRevokeId(null)}
        title="Revoke this session?"
        description="That device will be signed out and required to sign in again."
        footer={
          <>
            <Button
              variant="destructive"
              disabled={revoking === confirmRevokeId}
              onClick={() => void confirmRevoke()}
            >
              Revoke
            </Button>
            <Button variant="outline" onClick={() => setConfirmRevokeId(null)}>
              Cancel
            </Button>
          </>
        }
      />

      <ResponsiveDialog
        open={showRevokeAll}
        onOpenChange={setShowRevokeAll}
        title="Sign out all other devices?"
        description="Every other device will be signed out. They'll need to sign in again."
        footer={
          <>
            <Button
              variant="destructive"
              disabled={revokingAll}
              onClick={() => void confirmRevokeAll()}
            >
              Sign out all
            </Button>
            <Button variant="outline" onClick={() => setShowRevokeAll(false)}>
              Cancel
            </Button>
          </>
        }
      />
    </div>
  );
}

function SessionsPage() {
  return (
    <SettingsPage
      title="Sessions"
      description="Devices currently signed in. Revoke any you don't recognise; the device will be required to sign in again."
    >
      <h2 className="text-sm font-semibold text-foreground mb-3">Active sessions</h2>
      <SessionsList />
    </SettingsPage>
  );
}
