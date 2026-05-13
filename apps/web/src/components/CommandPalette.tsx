import { useNavigate, useRouter } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  CreditCard,
  FileText,
  Folder,
  Key,
  KeyRound,
  Lock,
  LogOut,
  MonitorSmartphone,
  Moon,
  Plus,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Sun,
  Trash2,
  User,
  Wallet,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { generateTotpCode } from '@blindpass/crypto';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { type DecryptedGlobalVaultItem, useAllVaultItems } from '@/hooks/useVault';
import { useFolders } from '@/hooks/useFolders';
import { getItemSubtitle } from '@/components/vault/ItemCard';
import { session } from '@/lib/session';

type Action = {
  id: string;
  group: 'item' | 'folder' | 'vault' | 'nav' | 'action';
  title: string;
  subtitle?: string;
  hint?: string;
  icon: ReactNode;
  haystack: string;
  run: () => void | Promise<void>;
  copyValue?: () => string | null;
  copyLabel?: string;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLockRequested: () => void;
  onSignOutRequested: () => void;
  onToggleTheme: () => void;
  isDark: boolean;
}

function score(query: string, haystack: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  const h = haystack.toLowerCase();
  if (h === q) return 100;
  if (h.startsWith(q)) return 80;
  const idx = h.indexOf(q);
  if (idx >= 0) return 60 - Math.min(idx, 40);
  let qi = 0;
  for (let i = 0; i < h.length && qi < q.length; i++) {
    if (h[i] === q[qi]) qi++;
  }
  return qi === q.length ? 20 : 0;
}

function copyToClipboard(text: string, label: string) {
  void navigator.clipboard.writeText(text).then(
    () => toast.success(`${label} copied`),
    () => toast.error('Failed to copy'),
  );
}

function itemPasswordOrCode(
  item: DecryptedGlobalVaultItem,
): { value: string; label: string } | null {
  if (item.type === 'login') return { value: item.password, label: 'Password' };
  if (item.type === 'totp') {
    return {
      value: generateTotpCode(item.secret, {
        algorithm: item.algorithm,
        digits: item.digits,
        period: item.period,
      }),
      label: 'Code',
    };
  }
  return null;
}

export function CommandPalette({
  open,
  onOpenChange,
  onLockRequested,
  onSignOutRequested,
  onToggleTheme,
  isDark,
}: Props) {
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const { data: items = [] } = useAllVaultItems();
  const { data: folders = [] } = useFolders();

  const s = session.get();
  const vaults = s ? Array.from(s.vaults.entries()).map(([id, v]) => ({ id, name: v.name })) : [];
  const activeVaultId = s?.activeVaultId ?? '';

  function close() {
    onOpenChange(false);
  }

  function navigateAndClose(to: Parameters<typeof navigate>[0]) {
    void navigate(to);
    close();
  }

  const actions: Action[] = useMemo(() => {
    const list: Action[] = [];

    list.push({
      id: 'action:new-item',
      group: 'action',
      title: 'New item',
      subtitle: 'Create a new vault item',
      hint: 'N',
      icon: <Plus className="w-4 h-4" />,
      haystack: 'new item create add',
      run: () => navigateAndClose({ to: '/items/new' }),
    });
    list.push({
      id: 'action:lock',
      group: 'action',
      title: 'Lock vault',
      subtitle: 'Clear keys from memory',
      icon: <Lock className="w-4 h-4" />,
      haystack: 'lock vault session',
      run: () => {
        close();
        onLockRequested();
      },
    });
    list.push({
      id: 'action:sign-out',
      group: 'action',
      title: 'Sign out',
      subtitle: 'End session and clear local data',
      icon: <LogOut className="w-4 h-4" />,
      haystack: 'sign out logout exit',
      run: () => {
        close();
        onSignOutRequested();
      },
    });
    list.push({
      id: 'action:theme',
      group: 'action',
      title: isDark ? 'Switch to light theme' : 'Switch to dark theme',
      icon: isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />,
      haystack: 'theme dark light mode',
      run: () => {
        onToggleTheme();
        close();
      },
    });

    list.push({
      id: 'nav:vault',
      group: 'nav',
      title: 'Go to Vault',
      icon: <KeyRound className="w-4 h-4" />,
      haystack: 'vault home',
      run: () => navigateAndClose({ to: '/' }),
    });
    list.push({
      id: 'nav:health',
      group: 'nav',
      title: 'Go to Health',
      icon: <ShieldCheck className="w-4 h-4" />,
      haystack: 'health audit security weak reused',
      run: () => navigateAndClose({ to: '/health' }),
    });
    list.push({
      id: 'nav:trash',
      group: 'nav',
      title: 'Go to Trash',
      icon: <Trash2 className="w-4 h-4" />,
      haystack: 'trash deleted',
      run: () => navigateAndClose({ to: '/trash' }),
    });
    list.push({
      id: 'nav:settings',
      group: 'nav',
      title: 'Go to Settings',
      icon: <Settings className="w-4 h-4" />,
      haystack: 'settings preferences',
      run: () => navigateAndClose({ to: '/settings' }),
    });
    list.push({
      id: 'nav:sessions',
      group: 'nav',
      title: 'Go to Sessions',
      icon: <MonitorSmartphone className="w-4 h-4" />,
      haystack: 'sessions devices',
      run: () => navigateAndClose({ to: '/sessions' }),
    });

    for (const v of vaults) {
      if (v.id === activeVaultId) continue;
      list.push({
        id: `vault:${v.id}`,
        group: 'vault',
        title: v.name,
        subtitle: 'Switch vault',
        icon: <Folder className="w-4 h-4" />,
        haystack: `vault ${v.name}`,
        run: () => {
          if (s) {
            session.switchVault(v.id);
            qc.removeQueries();
            window.dispatchEvent(new CustomEvent('bp:vault-switch'));
            void router.invalidate();
          }
          close();
        },
      });
    }

    for (const f of folders) {
      list.push({
        id: `folder:${f.id}`,
        group: 'folder',
        title: f.name,
        subtitle: 'Filter by folder',
        icon: <Folder className="w-4 h-4" />,
        haystack: `folder ${f.name}`,
        run: () => navigateAndClose({ to: '/' }),
      });
    }

    for (const item of items) {
      const baseSubtitle =
        getItemSubtitle(item as unknown as { type: string; [key: string]: unknown }) ||
        item.type.replace('_', ' ');
      const vaultName =
        vaults.length > 1
          ? (vaults.find((v) => v.id === item.vaultId)?.name ?? undefined)
          : undefined;
      const subtitle = [baseSubtitle, vaultName].filter(Boolean).join(' · ');
      const cred = itemPasswordOrCode(item);
      list.push({
        id: `item:${item.id}`,
        group: 'item',
        title: item.title,
        subtitle,
        hint: cred ? `⌘C ${cred.label.toLowerCase()}` : undefined,
        icon: <ItemTypeIcon type={item.type} />,
        haystack: `${item.title} ${baseSubtitle} ${item.type}${vaultName ? ` ${vaultName}` : ''}`,
        run: () => {
          if (item.vaultId !== activeVaultId && s) {
            session.switchVault(item.vaultId);
            qc.removeQueries();
            window.dispatchEvent(new CustomEvent('bp:vault-switch'));
            void router.invalidate();
          }
          navigateAndClose({ to: '/$itemId', params: { itemId: item.id } as never });
        },
        copyValue: cred ? () => cred.value : undefined,
        copyLabel: cred?.label,
      });
    }

    return list;
  }, [
    activeVaultId,
    folders,
    isDark,
    items,
    navigate,
    onLockRequested,
    onSignOutRequested,
    onToggleTheme,
    qc,
    router,
    s,
    vaults,
  ]);

  const filtered = useMemo(() => {
    if (!query.trim()) {
      return [...actions]
        .map((a) => ({ a, s: a.group === 'item' ? 1 : 2 }))
        .sort((x, y) => y.s - x.s)
        .map((x) => x.a)
        .slice(0, 50);
    }
    return actions
      .map((a) => ({ a, s: score(query, `${a.title} ${a.haystack}`) }))
      .filter((x) => x.s > 0)
      .sort((x, y) => y.s - x.s)
      .map((x) => x.a)
      .slice(0, 50);
  }, [actions, query]);

  useEffect(() => {
    setSelected(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${selected}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const a = filtered[selected];
      if (a) void a.run();
    } else if (
      (e.key === 'c' || e.key === 'C') &&
      (e.metaKey || e.ctrlKey) &&
      filtered[selected]?.copyValue
    ) {
      e.preventDefault();
      const a = filtered[selected];
      const value = a.copyValue?.();
      if (value && a.copyLabel) {
        copyToClipboard(value, a.copyLabel);
        close();
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[calc(100%-1rem)] w-full p-0 gap-0 overflow-hidden rounded-xl !top-[8%] !translate-y-0"
        onKeyDown={onKeyDown}
        container={document.getElementById('app-shell')}
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">
          Search items, jump to pages, or run actions.
        </DialogDescription>
        <div className="flex items-center gap-2 px-3 h-11 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            data-testid="command-palette-input"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items, vaults, actions…"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground/60"
            aria-label="Command palette search"
          />
          <kbd className="text-[10px] font-mono text-muted-foreground/60 border border-border/60 rounded px-1.5 py-0.5">
            Esc
          </kbd>
        </div>
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center text-xs text-muted-foreground">
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            renderGrouped(filtered, selected, setSelected, (a) => void a.run())
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function renderGrouped(
  actions: Action[],
  selected: number,
  setSelected: (idx: number) => void,
  run: (a: Action) => void,
) {
  const groupOrder: Action['group'][] = ['item', 'folder', 'vault', 'nav', 'action'];
  const labels: Record<Action['group'], string> = {
    item: 'Items',
    folder: 'Folders',
    vault: 'Vaults',
    nav: 'Navigate',
    action: 'Actions',
  };
  const groups = new Map<Action['group'], { action: Action; idx: number }[]>();
  actions.forEach((a, idx) => {
    const arr = groups.get(a.group) ?? [];
    arr.push({ action: a, idx });
    groups.set(a.group, arr);
  });
  return groupOrder
    .filter((g) => groups.has(g))
    .map((g) => (
      <div key={g}>
        <div className="px-3 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
          {labels[g]}
        </div>
        {groups.get(g)!.map(({ action, idx }) => (
          <button
            key={action.id}
            data-idx={idx}
            data-testid={`command-row-${action.id}`}
            onPointerEnter={() => setSelected(idx)}
            onClick={() => run(action)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
              idx === selected
                ? 'bg-primary/10 text-foreground'
                : 'text-foreground hover:bg-accent/40'
            }`}
          >
            <span
              className={`shrink-0 ${idx === selected ? 'text-primary' : 'text-muted-foreground'}`}
            >
              {action.icon}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block truncate">{action.title}</span>
              {action.subtitle && (
                <span className="block text-[11px] text-muted-foreground truncate">
                  {action.subtitle}
                </span>
              )}
            </span>
            {action.hint && (
              <span className="shrink-0 text-[10px] font-mono text-muted-foreground/60">
                {action.hint}
              </span>
            )}
          </button>
        ))}
      </div>
    ));
}

function ItemTypeIcon({ type }: { type: string }) {
  const cls = 'w-4 h-4';
  switch (type) {
    case 'login':
      return <KeyRound className={cls} />;
    case 'secure_note':
      return <FileText className={cls} />;
    case 'payment_card':
      return <CreditCard className={cls} />;
    case 'identity':
      return <User className={cls} />;
    case 'totp':
      return <Shield className={cls} />;
    case 'developer_credential':
      return <Key className={cls} />;
    case 'crypto_wallet':
      return <Wallet className={cls} />;
    default:
      return <KeyRound className={cls} />;
  }
}
