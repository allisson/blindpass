import { Link, useRouterState } from '@tanstack/react-router';
import {
  Download,
  Fingerprint,
  KeyRound,
  LayoutList,
  Monitor,
  Palette,
  ShieldCheck,
  Smartphone,
  Timer,
  Trash2,
  Upload,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { loadTheme, type Theme } from '@/lib/theme';
import { loadDensity, type Density } from '@/lib/density';
import { session } from '@/lib/session';

const THEME_LABEL: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

const DENSITY_LABEL: Record<Density, string> = {
  cozy: 'Cozy',
  compact: 'Compact',
};

function formatLockMinutes(m: number): string {
  if (m === 0) return 'Off';
  if (m === 60) return '1 hour';
  return `${m} min`;
}

const STANDALONE_QUERY = '(display-mode: standalone)';

interface RowProps {
  to:
    | '/settings/appearance'
    | '/settings/density'
    | '/settings/auto-lock'
    | '/settings/master-password'
    | '/settings/verification-id'
    | '/settings/biometric-unlock'
    | '/settings/import'
    | '/settings/export'
    | '/settings/install-app'
    | '/settings/delete-account'
    | '/settings/sessions';
  label: string;
  hint?: string;
  destructive?: boolean;
  icon: ReactNode;
}

function Row({ to, label, hint, destructive, icon }: RowProps) {
  return (
    <Link
      to={to}
      className={[
        'group flex items-center gap-3 h-12 px-4 text-[14px] font-medium transition-colors border-b border-muted last:border-b-0',
        destructive
          ? 'text-foreground hover:bg-destructive/10 hover:text-destructive [&.active]:bg-destructive/10 [&.active]:text-destructive'
          : 'text-foreground hover:bg-accent/60 [&.active]:bg-accent',
      ].join(' ')}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {hint ? (
        <span className="text-[12px] font-medium text-muted-foreground group-[.active]:text-muted-foreground tabular-nums shrink-0">
          {hint}
        </span>
      ) : null}
    </Link>
  );
}

function IconTile({ children, className }: { children: ReactNode; className: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center w-[22px] h-[22px] rounded-[5px] ${className}`}
    >
      {children}
    </span>
  );
}

function GroupHeader({ children }: { children: string }) {
  return (
    <div className="px-4 pt-5 pb-1.5 first:pt-3 text-[10px] font-bold tracking-[0.1em] uppercase text-muted-foreground">
      {children}
    </div>
  );
}

export function SettingsListPanel() {
  const [theme, setTheme] = useState<Theme>(() => loadTheme());
  const [density, setDensity] = useState<Density>(() => loadDensity());
  const [lockMinutes, setLockMinutes] = useState(() => session.getIdleMinutes());
  const [installed, setInstalled] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(STANDALONE_QUERY).matches,
  );

  const navRef = useRef<HTMLElement>(null);
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;

  useEffect(() => {
    function onTheme(e: Event) {
      setTheme((e as CustomEvent<Theme>).detail);
    }
    window.addEventListener('bp:theme-change', onTheme);
    return () => window.removeEventListener('bp:theme-change', onTheme);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia(STANDALONE_QUERY);
    const onChange = (e: MediaQueryListEvent) => setInstalled(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    function syncDensity() {
      setDensity(loadDensity());
    }
    function syncLock() {
      setLockMinutes(session.getIdleMinutes());
    }
    window.addEventListener('bp:density-change', syncDensity);
    window.addEventListener('bp:auto-lock-change', syncLock);
    return () => {
      window.removeEventListener('bp:density-change', syncDensity);
      window.removeEventListener('bp:auto-lock-change', syncLock);
    };
  }, []);

  useEffect(() => {
    setDensity(loadDensity());
    setLockMinutes(session.getIdleMinutes());
  }, [pathname]);

  function onKeyDown(e: React.KeyboardEvent<HTMLElement>) {
    const links = Array.from(navRef.current?.querySelectorAll<HTMLAnchorElement>('a[href]') ?? []);
    if (links.length === 0) return;
    const idx = links.findIndex((l) => l === document.activeElement);
    if (idx === -1) return;
    if (e.key === 'ArrowDown' || e.key === 'j') {
      e.preventDefault();
      links[Math.min(idx + 1, links.length - 1)]?.focus();
    } else if (e.key === 'ArrowUp' || e.key === 'k') {
      e.preventDefault();
      links[Math.max(idx - 1, 0)]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      links[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      links[links.length - 1]?.focus();
    }
  }

  return (
    <nav ref={navRef} onKeyDown={onKeyDown} aria-label="Settings" className="flex flex-col">
      <div className="h-14 bg-card border-b border-border shrink-0 flex items-center px-4 gap-3">
        <h1 className="text-[16px] font-bold tracking-[-0.01em] text-foreground flex-1">
          Settings
        </h1>
      </div>
      <div className="pb-4">
        <GroupHeader>Preferences</GroupHeader>
        <Row
          to="/settings/appearance"
          label="Appearance"
          hint={THEME_LABEL[theme]}
          icon={
            <IconTile className="bg-violet-500/15 text-violet-500">
              <Palette className="w-3.5 h-3.5" />
            </IconTile>
          }
        />
        <Row
          to="/settings/density"
          label="Density"
          hint={DENSITY_LABEL[density]}
          icon={
            <IconTile className="bg-sky-500/15 text-sky-500">
              <LayoutList className="w-3.5 h-3.5" />
            </IconTile>
          }
        />
        <Row
          to="/settings/auto-lock"
          label="Auto-lock"
          hint={formatLockMinutes(lockMinutes)}
          icon={
            <IconTile className="bg-amber-500/15 text-amber-500">
              <Timer className="w-3.5 h-3.5" />
            </IconTile>
          }
        />

        <GroupHeader>Security</GroupHeader>
        <Row
          to="/settings/master-password"
          label="Master password"
          icon={
            <IconTile className="bg-blue-500/15 text-blue-500">
              <KeyRound className="w-3.5 h-3.5" />
            </IconTile>
          }
        />
        <Row
          to="/settings/biometric-unlock"
          label="Biometric unlock"
          icon={
            <IconTile className="bg-green-500/15 text-green-500">
              <Fingerprint className="w-3.5 h-3.5" />
            </IconTile>
          }
        />
        <Row
          to="/settings/verification-id"
          label="Verification ID"
          icon={
            <IconTile className="bg-emerald-500/15 text-emerald-500">
              <ShieldCheck className="w-3.5 h-3.5" />
            </IconTile>
          }
        />

        <GroupHeader>Data</GroupHeader>
        <Row
          to="/settings/import"
          label="Import"
          icon={
            <IconTile className="bg-cyan-500/15 text-cyan-500">
              <Download className="w-3.5 h-3.5" />
            </IconTile>
          }
        />
        <Row
          to="/settings/export"
          label="Export"
          icon={
            <IconTile className="bg-indigo-500/15 text-indigo-500">
              <Upload className="w-3.5 h-3.5" />
            </IconTile>
          }
        />

        <GroupHeader>Account</GroupHeader>
        <Row
          to="/settings/sessions"
          label="Sessions"
          icon={
            <IconTile className="bg-slate-500/15 text-slate-500">
              <Monitor className="w-3.5 h-3.5" />
            </IconTile>
          }
        />
        <Row
          to="/settings/install-app"
          label="Install app"
          hint={installed ? 'Installed' : undefined}
          icon={
            <IconTile className="bg-pink-500/15 text-pink-500">
              <Smartphone className="w-3.5 h-3.5" />
            </IconTile>
          }
        />
        <Row
          to="/settings/delete-account"
          label="Delete account"
          destructive
          icon={
            <IconTile className="bg-destructive/15 text-destructive">
              <Trash2 className="w-3.5 h-3.5" />
            </IconTile>
          }
        />
      </div>
    </nav>
  );
}
