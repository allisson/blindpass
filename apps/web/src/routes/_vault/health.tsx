import { Link, createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Siren,
} from 'lucide-react';
import { type DecryptedItem, useVaultItems } from '@/hooks/useVault';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ItemAvatar } from '@/components/vault/ItemAvatar';
import { getItemSubtitle } from '@/components/vault/ItemCard';
import { passwordStrength } from '@/lib/passwordStrength';
import { checkBreachesBatch, type BreachResult } from '@/lib/hibp';
import { toast } from 'sonner';
import { useOpenCommandPalette } from '@/components/vault/shell/CommandPaletteContext';

export const Route = createFileRoute('/_vault/health')({
  component: HealthPage,
});

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

type LoginItem = DecryptedItem & { type: 'login'; password: string };

function isLogin(item: DecryptedItem): item is LoginItem {
  return item.type === 'login';
}

interface Findings {
  weak: LoginItem[];
  reused: { password: string; items: LoginItem[] }[];
  old: LoginItem[];
}

function computeFindings(items: DecryptedItem[]): Findings {
  const logins = items.filter(isLogin).filter((l) => l.password);
  const weak = logins.filter((l) => passwordStrength(l.password) < 2);

  const buckets = new Map<string, LoginItem[]>();
  for (const l of logins) {
    const arr = buckets.get(l.password) ?? [];
    arr.push(l);
    buckets.set(l.password, arr);
  }
  const reused = [...buckets.entries()]
    .filter(([, arr]) => arr.length > 1)
    .map(([password, items]) => ({ password, items }));

  const now = Date.now();
  const old = logins.filter((l) => {
    const ts = l.updatedAt ? Date.parse(l.updatedAt) : NaN;
    return !isNaN(ts) && now - ts > ONE_YEAR_MS;
  });

  return { weak, reused, old };
}

type Tone = 'danger' | 'attention' | 'muted';

const TONE_TEXT: Record<Tone, string> = {
  danger: 'text-destructive',
  attention: 'text-[var(--accent-teal)]',
  muted: 'text-muted-foreground',
};

const TONE_CHIP: Record<Tone, string> = {
  danger: 'text-destructive bg-destructive/10 border-destructive/20',
  attention: 'text-[var(--accent-teal)] bg-[var(--accent-teal)]/10 border-[var(--accent-teal)]/25',
  muted: 'text-muted-foreground bg-muted border-border',
};

function FindingRow({ item, hint }: { item: DecryptedItem; hint: string }) {
  return (
    <Link
      to="/$itemId"
      params={{ itemId: item.id }}
      className="flex items-center gap-[14px] px-4 py-3 hover:bg-accent/60 transition-colors border-b border-muted last:border-b-0"
    >
      <ItemAvatar item={item} />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold tracking-[-0.01em] text-foreground truncate">
          {item.title}
        </p>
        <p className="text-[12px] font-medium text-muted-foreground truncate mt-0.5">
          {getItemSubtitle(item)}
        </p>
      </div>
      <span className="text-[11px] font-medium text-muted-foreground shrink-0 tabular-nums">
        {hint}
      </span>
    </Link>
  );
}

function Section({
  Icon,
  title,
  count,
  tone,
  children,
}: {
  Icon: typeof AlertTriangle;
  title: string;
  count: number | string;
  tone: Tone;
  children?: React.ReactNode;
}) {
  return (
    <section className="bg-card border border-border rounded overflow-hidden">
      <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-muted">
        <div className="flex items-center gap-2 text-foreground">
          <Icon className="w-4 h-4 text-muted-foreground" aria-hidden />
          <h2 className="text-[13px] font-semibold">{title}</h2>
        </div>
        <span className={`text-xs font-mono tabular-nums ${TONE_TEXT[tone]}`}>{count}</span>
      </header>
      {children}
    </section>
  );
}

function TopBar() {
  const openCommandPalette = useOpenCommandPalette();
  return (
    <div className="h-14 bg-card border-b border-border shrink-0 flex items-center px-4 gap-3">
      <ShieldCheck className="w-5 h-5 text-muted-foreground shrink-0" />
      <span className="text-[16px] font-bold tracking-[-0.01em] text-foreground flex-1">
        Password Health
      </span>
      <button
        onClick={openCommandPalette}
        className="w-8 h-8 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0 touch-manipulation"
        aria-label="Search and commands"
      >
        <Search className="w-4 h-4" />
      </button>
    </div>
  );
}

function HealthPage() {
  const { data: items, isLoading } = useVaultItems();
  const [breaches, setBreaches] = useState<BreachResult[] | null>(null);
  const [breachProgress, setBreachProgress] = useState<{ done: number; total: number } | null>(
    null,
  );

  const findings = useMemo(() => (items ? computeFindings(items) : null), [items]);

  const affectedIds = useMemo(() => {
    if (!findings) return null;
    const ids = new Set<string>();
    findings.weak.forEach((i) => ids.add(i.id));
    findings.reused.forEach((g) => g.items.forEach((i) => ids.add(i.id)));
    findings.old.forEach((i) => ids.add(i.id));
    breaches?.forEach((b) => ids.add(b.itemId));
    return ids;
  }, [findings, breaches]);

  async function runBreachCheck() {
    if (!items) return;
    const logins = items.filter(isLogin).filter((l) => l.password);
    if (!logins.length) {
      toast.info('No logins to check');
      return;
    }
    setBreachProgress({ done: 0, total: logins.length });
    setBreaches(null);
    try {
      const results = await checkBreachesBatch(
        logins.map((l) => ({ id: l.id, password: l.password })),
        (done, total) => setBreachProgress({ done, total }),
      );
      setBreaches(results);
      toast.success(
        results.length > 0
          ? `${results.length} breached password${results.length === 1 ? '' : 's'} found`
          : 'No breached passwords found',
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Breach check failed');
    } finally {
      setBreachProgress(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full" aria-busy="true" aria-label="Loading vault health">
        <TopBar />
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          <Skeleton className="h-4 w-48 rounded" />
          {Array.from({ length: 4 }).map((_, i) => (
            <section key={i} className="bg-card border border-border rounded overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="w-4 h-4 rounded" />
                  <Skeleton className="h-3.5 w-32 rounded" />
                </div>
                <Skeleton className="h-3 w-6 rounded" />
              </div>
            </section>
          ))}
        </div>
      </div>
    );
  }

  if (!findings || !items?.length) {
    return (
      <div className="flex flex-col h-full">
        <TopBar />
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-6">
          <ShieldCheck className="w-8 h-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No items to audit yet.</p>
        </div>
      </div>
    );
  }

  const logins = items.filter(isLogin);
  const reusedItemCount = findings.reused.reduce((acc, g) => acc + g.items.length, 0);
  const breachCount = breaches?.length ?? 0;
  const affected = affectedIds?.size ?? 0;

  const breachItems = breaches
    ? breaches
        .map((b) => {
          const item = items.find((i) => i.id === b.itemId);
          return item ? { item, count: b.count } : null;
        })
        .filter((x): x is { item: DecryptedItem; count: number } => x !== null)
    : null;

  const chips: { label: string; tone: Tone }[] = [
    { label: `${findings.weak.length} weak`, tone: findings.weak.length ? 'danger' : 'muted' },
    { label: `${reusedItemCount} reused`, tone: reusedItemCount ? 'attention' : 'muted' },
    { label: `${findings.old.length} old`, tone: findings.old.length ? 'attention' : 'muted' },
    breaches !== null
      ? { label: `${breachCount} breached`, tone: breachCount ? 'danger' : 'muted' }
      : { label: '— breached', tone: 'muted' },
  ];

  return (
    <div className="flex flex-col h-full">
      <TopBar />
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mb-5" data-testid="health-summary">
          <p className="text-[13px] text-foreground tabular-nums">
            {affected > 0 ? (
              <>
                <span className="text-destructive font-semibold">{affected}</span> of{' '}
                {logins.length} logins need attention.
              </>
            ) : (
              <span className="text-muted-foreground">
                {logins.length} login{logins.length === 1 ? '' : 's'}, no findings.
              </span>
            )}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <span
                key={c.label}
                className={`text-[11px] font-bold tracking-[0.04em] px-2 py-0.5 rounded-[3px] border tabular-nums ${TONE_CHIP[c.tone]}`}
              >
                {c.label}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Section
            Icon={AlertTriangle}
            title="Weak passwords"
            count={findings.weak.length}
            tone={findings.weak.length > 0 ? 'danger' : 'muted'}
          >
            {findings.weak.length > 0 ? (
              <ul data-testid="weak-list">
                {findings.weak.map((item) => (
                  <li key={item.id}>
                    <FindingRow item={item} hint="weak" />
                  </li>
                ))}
              </ul>
            ) : null}
          </Section>

          <Section
            Icon={RefreshCw}
            title="Reused passwords"
            count={reusedItemCount}
            tone={reusedItemCount > 0 ? 'attention' : 'muted'}
          >
            {findings.reused.length > 0 ? (
              <ul data-testid="reused-list">
                {findings.reused.map((group, idx) => (
                  <li key={idx} className={idx > 0 ? 'border-t border-muted' : ''}>
                    <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-muted-foreground px-4 py-2 bg-muted/40">
                      Reused across {group.items.length} logins
                    </p>
                    <ul>
                      {group.items.map((item) => (
                        <li key={item.id}>
                          <FindingRow item={item} hint="reused" />
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            ) : null}
          </Section>

          <Section
            Icon={Calendar}
            title="Old passwords (>1 year)"
            count={findings.old.length}
            tone={findings.old.length > 0 ? 'attention' : 'muted'}
          >
            {findings.old.length > 0 ? (
              <ul data-testid="old-list">
                {findings.old.map((item) => (
                  <li key={item.id}>
                    <FindingRow
                      item={item}
                      hint={`updated ${
                        item.updatedAt
                          ? new Date(item.updatedAt).toLocaleDateString(undefined, {
                              month: 'short',
                              year: 'numeric',
                            })
                          : 'long ago'
                      }`}
                    />
                  </li>
                ))}
              </ul>
            ) : null}
          </Section>

          <Section
            Icon={Siren}
            title="Breached passwords"
            count={breaches !== null ? (breachItems?.length ?? 0) : '—'}
            tone={breaches !== null && breachItems && breachItems.length > 0 ? 'danger' : 'muted'}
          >
            {breaches === null ? (
              <div className="px-4 py-3 flex flex-col gap-2">
                <p className="text-[12px] text-muted-foreground">
                  Sends only a 5-character SHA-1 prefix to Have I Been Pwned (k-anonymity); never
                  the password.
                </p>
                <Button
                  size="sm"
                  onClick={() => void runBreachCheck()}
                  disabled={breachProgress !== null}
                  data-testid="run-breach-check"
                  className="self-end"
                >
                  {breachProgress ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {breachProgress.done}/{breachProgress.total}
                    </>
                  ) : (
                    'Run check'
                  )}
                </Button>
              </div>
            ) : breachItems && breachItems.length > 0 ? (
              <ul data-testid="breach-list">
                {breachItems.map(({ item, count }) => (
                  <li key={item.id}>
                    <FindingRow item={item} hint={`seen ${count.toLocaleString()}× in breaches`} />
                  </li>
                ))}
              </ul>
            ) : null}
          </Section>
        </div>
      </div>
    </div>
  );
}
