import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMemo } from 'react';
import {
  CreditCard,
  FileText,
  HelpCircle,
  Key,
  KeyRound,
  Plus,
  Shield,
  ShieldCheck,
  User,
  Wallet,
} from 'lucide-react';
import { type DecryptedItem, useVaultItems } from '@/hooks/useVault';
import { buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ItemAvatar } from '@/components/vault/ItemAvatar';
import { getItemSubtitle } from '@/components/vault/ItemCard';
import { session } from '@/lib/session';
import { getRecentlyViewed } from '@/lib/recentlyViewed';
import { passwordStrength } from '@/lib/passwordStrength';

export const Route = createFileRoute('/_vault/')({
  component: VaultIndexPage,
});

const TYPE_META: Array<{
  value: DecryptedItem['type'];
  label: string;
  Icon: typeof KeyRound;
}> = [
  { value: 'login', label: 'Logins', Icon: KeyRound },
  { value: 'secure_note', label: 'Notes', Icon: FileText },
  { value: 'payment_card', label: 'Cards', Icon: CreditCard },
  { value: 'identity', label: 'Identities', Icon: User },
  { value: 'totp', label: 'Auth', Icon: Shield },
  { value: 'developer_credential', label: 'Developers', Icon: Key },
  { value: 'crypto_wallet', label: 'Wallets', Icon: Wallet },
];

const SHORTCUTS = [
  { key: '⌘K', desc: 'Command palette' },
  { key: '/', desc: 'Search' },
  { key: '↑↓', desc: 'Navigate list' },
  { key: 'N', desc: 'New item' },
  { key: 'Esc', desc: 'Close / clear' },
];

function HelpButton() {
  return (
    <Popover>
      <PopoverTrigger
        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
        aria-label="Keyboard shortcuts"
      >
        <HelpCircle className="w-4 h-4" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-2">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 mb-1.5 px-1">
          Shortcuts
        </p>
        <ul className="space-y-0.5">
          {SHORTCUTS.map(({ key, desc }) => (
            <li
              key={key}
              className="flex items-center justify-between px-1.5 py-1 rounded-md text-xs"
            >
              <span className="text-muted-foreground">{desc}</span>
              <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted font-mono text-[10px] text-foreground">
                {key}
              </kbd>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function TypeCount({
  Icon,
  label,
  count,
  onClick,
}: {
  Icon: typeof KeyRound;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group glass-card text-left px-4 py-3 hover:border-primary/40 transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground/70">
          {label}
        </span>
        <Icon className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
      </div>
      <p className="text-2xl font-heading font-semibold text-foreground mt-1 tabular-nums">
        {count}
      </p>
    </button>
  );
}

function VaultIndexPage() {
  const navigate = useNavigate();
  const { data: items, isLoading } = useVaultItems();
  const s = session.get();
  const username = s?.username ?? '';
  const initial = username.charAt(0).toUpperCase();
  const vaultName = s?.vaults.get(s.activeVaultId)?.name ?? 'Vault';

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items ?? []) {
      map.set(item.type, (map.get(item.type) ?? 0) + 1);
    }
    return map;
  }, [items]);

  const recent = useMemo(() => {
    if (!items?.length || !s) return [];
    const ids = getRecentlyViewed(s.activeVaultId);
    const byId = new Map(items.map((i) => [i.id, i] as const));
    return ids
      .map((id) => byId.get(id))
      .filter((x): x is DecryptedItem => Boolean(x))
      .slice(0, 5);
  }, [items, s]);

  const securityScore = useMemo(() => {
    if (!items?.length) return null;
    const logins = items.filter((i) => i.type === 'login') as DecryptedItem[];
    if (!logins.length) return null;
    let weak = 0;
    const seen = new Map<string, number>();
    for (const l of logins) {
      const pwd = (l as { password?: string }).password ?? '';
      if (!pwd) continue;
      if (passwordStrength(pwd) < 2) weak++;
      seen.set(pwd, (seen.get(pwd) ?? 0) + 1);
    }
    let reused = 0;
    for (const n of seen.values()) if (n > 1) reused += n;
    const total = logins.length;
    const healthyRatio = Math.max(0, total - weak - Math.floor(reused / 2)) / total;
    return {
      score: Math.round(healthyRatio * 100),
      total,
      weak,
      reused,
    };
  }, [items]);

  function gotoTypeFilter(type: string) {
    try {
      localStorage.setItem('bp:vault:typeFilter', JSON.stringify([type]));
    } catch {
      /* ignore */
    }
    void navigate({ to: '/' });
  }

  const total = items?.length ?? 0;

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `
            linear-gradient(oklch(0.720 0.155 195 / 1) 1px, transparent 1px),
            linear-gradient(90deg, oklch(0.720 0.155 195 / 1) 1px, transparent 1px)
          `,
          backgroundSize: '32px 32px',
          maskImage: 'radial-gradient(ellipse 60% 50% at 50% 0%, black 30%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 60% 50% at 50% 0%, black 30%, transparent 100%)',
        }}
      />
      <div className="relative z-10 flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8 max-w-3xl mx-auto w-full">
        <header className="flex items-start justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center shadow-sm shrink-0">
              <span className="text-sm font-bold text-primary">{initial || '?'}</span>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70">
                Welcome back
              </p>
              <h1 className="font-heading text-lg font-semibold text-foreground tracking-tight">
                {vaultName}
                {total > 0 && (
                  <span className="ml-2 text-xs font-normal font-mono text-muted-foreground tabular-nums">
                    {total} {total === 1 ? 'item' : 'items'}
                  </span>
                )}
              </h1>
              <p className="text-[11px] text-muted-foreground/70 mt-0.5">Your vault is unlocked</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <HelpButton />
            <Link
              to="/items/new"
              className={buttonVariants({ size: 'sm' }) + ' gap-1.5'}
              data-testid="dashboard-new-item"
            >
              <Plus className="w-3.5 h-3.5" />
              New item
            </Link>
          </div>
        </header>

        <section aria-label="By type" className="mb-6">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-2">
            By type
          </p>
          {isLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[68px] rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              {TYPE_META.map(({ value, label, Icon }) => (
                <TypeCount
                  key={value}
                  Icon={Icon}
                  label={label}
                  count={counts.get(value) ?? 0}
                  onClick={() => gotoTypeFilter(value)}
                />
              ))}
            </div>
          )}
        </section>

        <div className="grid lg:grid-cols-[1fr_auto] gap-4">
          <section aria-label="Recently viewed">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-2">
              Recently viewed
            </p>
            {recent.length === 0 ? (
              <div className="glass-card px-4 py-6 text-center">
                <p className="text-xs text-muted-foreground">Items you open will appear here.</p>
              </div>
            ) : (
              <ul className="space-y-1" data-testid="recently-viewed">
                {recent.map((item) => (
                  <li key={item.id}>
                    <Link
                      to="/$itemId"
                      params={{ itemId: item.id }}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent/40 transition-colors"
                    >
                      <ItemAvatar item={item} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {getItemSubtitle(item)}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label="Security at a glance" className="lg:w-56">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-2">
              Security
            </p>
            {securityScore ? (
              <SecurityCard
                score={securityScore.score}
                weak={securityScore.weak}
                reused={securityScore.reused}
              />
            ) : (
              <div className="glass-card px-4 py-6 text-center">
                <ShieldCheck className="w-5 h-5 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">
                  Add a login to see security insights.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function SecurityCard({ score, weak, reused }: { score: number; weak: number; reused: number }) {
  const tone =
    score >= 80
      ? 'text-primary'
      : score >= 50
        ? 'text-[oklch(0.72_0.155_195)]'
        : 'text-destructive';
  return (
    <div className="glass-card p-4" data-testid="security-card">
      <div className="flex items-baseline gap-1">
        <span
          className={`font-heading text-3xl font-semibold tabular-nums ${tone}`}
          aria-label={`Security score ${score} out of 100`}
        >
          {score}
        </span>
        <span className="text-xs text-muted-foreground/70">/ 100</span>
      </div>
      <ul className="mt-2 space-y-0.5 text-[11px]">
        <li className="flex justify-between">
          <span className="text-muted-foreground">Weak passwords</span>
          <span
            className={`tabular-nums ${weak > 0 ? 'text-destructive' : 'text-muted-foreground/60'}`}
          >
            {weak}
          </span>
        </li>
        <li className="flex justify-between">
          <span className="text-muted-foreground">Reused passwords</span>
          <span
            className={`tabular-nums ${reused > 0 ? 'text-destructive' : 'text-muted-foreground/60'}`}
          >
            {reused}
          </span>
        </li>
      </ul>
    </div>
  );
}
