import { Link } from '@tanstack/react-router';
import { KeyRound, MonitorSmartphone, Settings, ShieldCheck, Trash2 } from 'lucide-react';

interface Props {
  showListPanel: boolean;
  trashCount: number;
  inert?: boolean;
}

export function BottomTabBar({ showListPanel, trashCount, inert }: Props) {
  const tabs: Array<{
    to: '/' | '/health' | '/trash' | '/settings' | '/sessions';
    label: string;
    Icon: typeof KeyRound;
    badge?: number;
    manualActive?: boolean;
  }> = [
    { to: '/', label: 'Vault', Icon: KeyRound, manualActive: showListPanel },
    { to: '/health', label: 'Health', Icon: ShieldCheck },
    { to: '/trash', label: 'Trash', Icon: Trash2, badge: trashCount },
    { to: '/settings', label: 'Settings', Icon: Settings },
    { to: '/sessions', label: 'Sessions', Icon: MonitorSmartphone },
  ];

  return (
    <nav
      data-testid="bottom-tab-bar"
      className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-popover/95 backdrop-blur-sm flex"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Primary"
      inert={inert || undefined}
    >
      {tabs.map(({ to, label, Icon, badge, manualActive }) => (
        <Link
          key={to}
          to={to}
          className={`relative flex-1 h-14 flex flex-col items-center justify-center gap-0.5 text-[10px] transition-colors ${
            manualActive !== undefined
              ? manualActive
                ? 'text-primary'
                : 'text-muted-foreground'
              : 'text-muted-foreground [&.active]:text-primary'
          }`}
          activeOptions={{ exact: to === '/' }}
        >
          <Icon className="w-4 h-4" />
          <span>{label}</span>
          {badge && badge > 0 ? (
            <span className="absolute top-1 right-1/3 text-[9px] font-mono px-1 rounded-full bg-destructive text-destructive-foreground">
              {badge}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
