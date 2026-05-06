import { Link, createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { AlertTriangle, Calendar, Loader2, RefreshCw, ShieldCheck, Siren } from 'lucide-react';
import { type DecryptedItem, useVaultItems } from '@/hooks/useVault';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ItemAvatar } from '@/components/vault/ItemAvatar';
import { getItemSubtitle } from '@/components/vault/ItemCard';
import { passwordStrength } from '@/lib/passwordStrength';
import { checkBreachesBatch, type BreachResult } from '@/lib/hibp';
import { toast } from 'sonner';

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

function FindingRow({ item, hint }: { item: DecryptedItem; hint: string }) {
  return (
    <Link
      to="/$itemId"
      params={{ itemId: item.id }}
      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent/40 transition-colors"
    >
      <ItemAvatar item={item} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
        <p className="text-xs text-muted-foreground truncate">{getItemSubtitle(item)}</p>
      </div>
      <span className="text-[11px] text-destructive shrink-0">{hint}</span>
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
  count: number;
  tone: 'danger' | 'warn' | 'ok';
  children: React.ReactNode;
}) {
  const colors = {
    danger: 'text-destructive bg-destructive/10 border-destructive/20',
    warn: 'text-[oklch(0.55_0.12_60)] bg-[oklch(0.55_0.12_60/0.1)] border-[oklch(0.55_0.12_60/0.2)]',
    ok: 'text-primary bg-primary/10 border-primary/20',
  } as const;
  return (
    <section className="glass-card p-4">
      <header className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span
            className={`w-7 h-7 rounded-lg border flex items-center justify-center ${colors[tone]}`}
          >
            <Icon className="w-3.5 h-3.5" />
          </span>
          <h2 className="font-heading text-sm font-semibold text-foreground">{title}</h2>
        </div>
        <span className="text-xs font-mono text-muted-foreground tabular-nums">{count}</span>
      </header>
      {children}
    </section>
  );
}

function HealthPage() {
  const { data: items, isLoading } = useVaultItems();
  const [breaches, setBreaches] = useState<BreachResult[] | null>(null);
  const [breachProgress, setBreachProgress] = useState<{ done: number; total: number } | null>(
    null,
  );

  const findings = useMemo(() => (items ? computeFindings(items) : null), [items]);

  const score = useMemo(() => {
    if (!findings || !items) return null;
    const logins = items.filter(isLogin);
    if (!logins.length) return null;
    const reusedItemCount = findings.reused.reduce((acc, g) => acc + g.items.length, 0);
    const issues = findings.weak.length + reusedItemCount + findings.old.length;
    const breachCount = breaches?.length ?? 0;
    const ratio = Math.max(0, logins.length - issues - breachCount * 2) / logins.length;
    return Math.round(ratio * 100);
  }, [findings, items, breaches]);

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
      <div
        className="h-full overflow-y-auto px-4 py-6 lg:px-6 lg:py-8 max-w-3xl mx-auto w-full"
        aria-busy="true"
        aria-label="Loading vault health"
      >
        <header className="mb-6 space-y-2">
          <Skeleton className="h-3 w-12 rounded" />
          <Skeleton className="h-6 w-40 rounded" />
          <Skeleton className="h-3 w-3/4 rounded" />
        </header>
        <div className="glass-card p-5 mb-6 flex items-baseline gap-3">
          <Skeleton className="h-12 w-20 rounded" />
          <Skeleton className="h-3 w-10 rounded" />
          <Skeleton className="ml-auto h-2.5 w-24 rounded" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <section key={i} className="glass-card p-4">
              <header className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="w-7 h-7 rounded-lg" />
                  <Skeleton className="h-3.5 w-32 rounded" />
                </div>
                <Skeleton className="h-3 w-6 rounded" />
              </header>
              <Skeleton className="h-3 w-2/3 rounded" />
            </section>
          ))}
        </div>
      </div>
    );
  }

  if (!findings || !items?.length) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-center p-6">
        <ShieldCheck className="w-8 h-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No items to audit yet.</p>
      </div>
    );
  }

  const breachItems = breaches
    ? breaches
        .map((b) => {
          const item = items.find((i) => i.id === b.itemId);
          return item ? { item, count: b.count } : null;
        })
        .filter((x): x is { item: DecryptedItem; count: number } => x !== null)
    : null;

  return (
    <div className="h-full overflow-y-auto px-4 py-6 lg:px-6 lg:py-8 max-w-3xl mx-auto w-full">
      <header className="mb-6">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70">Audit</p>
        <h1 className="font-heading text-xl font-semibold text-foreground tracking-tight">
          Vault health
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          All checks run locally. Breach check sends only a 5-character password-hash prefix
          (k-anonymity) — never the full hash or password.
        </p>
      </header>

      {score !== null &&
        (() => {
          const verdict =
            score >= 90
              ? 'Excellent'
              : score >= 80
                ? 'Strong'
                : score >= 50
                  ? 'Needs attention'
                  : 'At risk';
          const tone =
            score >= 80
              ? 'text-primary'
              : score >= 50
                ? 'text-[oklch(0.55_0.12_60)]'
                : 'text-destructive';
          const reusedItemCount = findings.reused.reduce((acc, g) => acc + g.items.length, 0);
          const breachCount = breaches?.length ?? 0;
          const chips: { label: string; tone: 'danger' | 'warn' | 'ok' }[] = [
            { label: `${findings.weak.length} weak`, tone: findings.weak.length ? 'danger' : 'ok' },
            { label: `${reusedItemCount} reused`, tone: reusedItemCount ? 'warn' : 'ok' },
            { label: `${findings.old.length} old`, tone: findings.old.length ? 'warn' : 'ok' },
            ...(breaches !== null
              ? [
                  {
                    label: `${breachCount} breached`,
                    tone: (breachCount ? 'danger' : 'ok') as 'danger' | 'warn' | 'ok',
                  },
                ]
              : []),
          ];
          const chipColors = {
            danger: 'text-destructive bg-destructive/10 border-destructive/20',
            warn: 'text-[oklch(0.55_0.12_60)] bg-[oklch(0.55_0.12_60/0.1)] border-[oklch(0.55_0.12_60/0.2)]',
            ok: 'text-muted-foreground bg-muted border-border',
          } as const;
          return (
            <div className="glass-card p-5 mb-6 space-y-3" data-testid="health-score-card">
              <div className="flex items-baseline gap-3">
                <span
                  className={`font-heading text-5xl font-semibold tabular-nums ${tone}`}
                  aria-label={`Health score ${score} out of 100`}
                >
                  {score}
                </span>
                <span className="text-sm text-muted-foreground/70">/ 100</span>
                <span className={`ml-auto text-xs font-medium ${tone}`}>{verdict}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {chips.map((c) => (
                  <span
                    key={c.label}
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full border tabular-nums ${chipColors[c.tone]}`}
                  >
                    {c.label}
                  </span>
                ))}
                <span className="ml-auto text-[11px] text-muted-foreground/70 self-center">
                  {items.filter(isLogin).length} login
                  {items.filter(isLogin).length === 1 ? '' : 's'} audited
                </span>
              </div>
            </div>
          );
        })()}

      <div className="space-y-3">
        <Section
          Icon={AlertTriangle}
          title="Weak passwords"
          count={findings.weak.length}
          tone={findings.weak.length > 0 ? 'danger' : 'ok'}
        >
          {findings.weak.length === 0 ? (
            <p className="text-xs text-muted-foreground px-1 py-1">
              All passwords meet minimum strength.
            </p>
          ) : (
            <ul className="space-y-0.5" data-testid="weak-list">
              {findings.weak.map((item) => (
                <li key={item.id}>
                  <FindingRow item={item} hint="weak" />
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          Icon={RefreshCw}
          title="Reused passwords"
          count={findings.reused.reduce((acc, g) => acc + g.items.length, 0)}
          tone={findings.reused.length > 0 ? 'warn' : 'ok'}
        >
          {findings.reused.length === 0 ? (
            <p className="text-xs text-muted-foreground px-1 py-1">
              No password is used more than once.
            </p>
          ) : (
            <ul className="space-y-3" data-testid="reused-list">
              {findings.reused.map((group, idx) => (
                <li key={idx}>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 px-1 mb-1">
                    Reused across {group.items.length}
                  </p>
                  <ul className="space-y-0.5">
                    {group.items.map((item) => (
                      <li key={item.id}>
                        <FindingRow item={item} hint="reused" />
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          Icon={Calendar}
          title="Old passwords (>1 year)"
          count={findings.old.length}
          tone={findings.old.length > 0 ? 'warn' : 'ok'}
        >
          {findings.old.length === 0 ? (
            <p className="text-xs text-muted-foreground px-1 py-1">
              No password is over a year old.
            </p>
          ) : (
            <ul className="space-y-0.5" data-testid="old-list">
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
          )}
        </Section>

        <Section
          Icon={Siren}
          title="Breached passwords"
          count={breachItems?.length ?? 0}
          tone={breachItems && breachItems.length > 0 ? 'danger' : 'ok'}
        >
          {breaches === null ? (
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Check passwords against the Have I Been Pwned database.
              </p>
              <Button
                size="sm"
                onClick={() => void runBreachCheck()}
                disabled={breachProgress !== null}
                data-testid="run-breach-check"
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
          ) : breachItems && breachItems.length === 0 ? (
            <p className="text-xs text-muted-foreground px-1 py-1">No breached passwords found.</p>
          ) : (
            <ul className="space-y-0.5" data-testid="breach-list">
              {breachItems!.map(({ item, count }) => (
                <li key={item.id}>
                  <FindingRow item={item} hint={`seen ${count.toLocaleString()}× in breaches`} />
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
