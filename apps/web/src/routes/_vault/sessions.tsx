import { createFileRoute } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { AlertCircle, LogOut, MonitorSmartphone } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@blindpass/api-schema';
import { Button } from '@/components/ui/button';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { EmptyState } from '@/components/EmptyState';
import { toast } from 'sonner';

export const Route = createFileRoute('/_vault/sessions')({
  component: SessionsPage,
});

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function SessionsSection() {
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
      .then((res) => setSessions(res.sessions))
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRevoke(id: string) {
    setRevoking(id);
    try {
      await api.deleteSession(id);
      setSessions((prev) => prev?.filter((s) => s.id !== id) ?? null);
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
      setSessions(res.sessions);
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
      <div className="flex items-center gap-2 text-destructive/70 text-xs">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        Failed to load sessions.
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={load}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (!sessions) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sessions.length === 0 && (
        <EmptyState Icon={MonitorSmartphone} title="No active sessions" size="sm" />
      )}
      {sessions.map((s) => (
        <div
          key={s.id}
          data-testid="session-row"
          className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5"
        >
          <div className="min-w-0 space-y-0.5">
            <p className="text-xs font-medium text-foreground truncate leading-tight">
              {s.userAgent || 'Unknown device'}
              {s.isCurrent && (
                <span className="ml-2 text-[10px] font-semibold text-primary bg-primary/10 border border-primary/20 rounded-full px-1.5 py-px">
                  This device
                </span>
              )}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Last active {formatRelative(s.lastUsedAt)} · Created {formatRelative(s.createdAt)}
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
        </div>
      ))}
      {sessions.some((s) => !s.isCurrent) && (
        <>
          <Separator />
          <Button
            variant="outline"
            size="sm"
            className="text-xs text-muted-foreground hover:text-destructive hover:border-destructive/40"
            disabled={revokingAll}
            onClick={() => setShowRevokeAll(true)}
          >
            <LogOut className="w-3 h-3" />
            {revokingAll ? 'Signing out…' : 'Sign out all other devices'}
          </Button>
        </>
      )}
      <ResponsiveDialog
        open={confirmRevokeId !== null}
        onOpenChange={(open) => !open && setConfirmRevokeId(null)}
        title="Revoke session?"
        description="This session will be signed out immediately. This cannot be undone."
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
        description="All other devices will be signed out immediately. This cannot be undone."
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
    <motion.div
      className="max-w-xl mx-auto px-6 py-8 space-y-6"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <div>
        <h1 className="font-heading text-lg font-semibold tracking-tight text-foreground">
          Active Sessions
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Devices currently logged in to your account.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <MonitorSmartphone className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-foreground">Sessions</h2>
            <p className="text-[11px] text-muted-foreground mt-px">
              Revoke access for devices you no longer use.
            </p>
          </div>
        </div>
        <Separator />
        <SessionsSection />
      </section>
    </motion.div>
  );
}
