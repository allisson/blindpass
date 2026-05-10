import { Link, useRouterState } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
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
    | '/settings/delete-account';
  label: string;
  hint?: string;
  destructive?: boolean;
}

function Row({ to, label, hint, destructive }: RowProps) {
  return (
    <Link
      to={to}
      className={[
        'group flex items-center justify-between gap-3 h-9 px-3 rounded-md text-sm transition-colors',
        destructive
          ? 'text-foreground/85 hover:bg-destructive/10 hover:text-destructive [&.active]:bg-destructive/10 [&.active]:text-destructive'
          : 'text-foreground/85 hover:bg-accent/60 hover:text-foreground [&.active]:bg-accent [&.active]:text-foreground',
      ].join(' ')}
    >
      <span className="truncate">{label}</span>
      {hint ? (
        <span className="text-xs text-muted-foreground/80 group-[.active]:text-muted-foreground tabular-nums shrink-0">
          {hint}
        </span>
      ) : null}
    </Link>
  );
}

function GroupHeader({ children }: { children: string }) {
  return (
    <div className="px-3 mt-5 mb-1.5 first:mt-2 text-caption font-medium text-muted-foreground">
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
    <nav
      ref={navRef}
      onKeyDown={onKeyDown}
      aria-label="Settings"
      className="flex flex-col md:h-full"
    >
      <div className="px-4 pt-4 pb-2 md:pt-5">
        <h2 className="font-heading text-base font-medium tracking-tight text-foreground">
          Settings
        </h2>
      </div>
      <div className="px-1 pb-4 md:flex-1 md:overflow-y-auto md:min-h-0">
        <GroupHeader>Preferences</GroupHeader>
        <Row to="/settings/appearance" label="Appearance" hint={THEME_LABEL[theme]} />
        <Row to="/settings/density" label="Density" hint={DENSITY_LABEL[density]} />
        <Row to="/settings/auto-lock" label="Auto-lock" hint={formatLockMinutes(lockMinutes)} />

        <GroupHeader>Security</GroupHeader>
        <Row to="/settings/master-password" label="Master password" />
        <Row to="/settings/biometric-unlock" label="Biometric unlock" />
        <Row to="/settings/verification-id" label="Verification ID" />

        <GroupHeader>Data</GroupHeader>
        <Row to="/settings/import" label="Import" />
        <Row to="/settings/export" label="Export" />

        <GroupHeader>Account</GroupHeader>
        <Row
          to="/settings/install-app"
          label="Install app"
          hint={installed ? 'Installed' : undefined}
        />
        <Row to="/settings/delete-account" label="Delete account" destructive />
      </div>
    </nav>
  );
}
