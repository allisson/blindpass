import { Link } from '@tanstack/react-router';
import { KeyRound, Settings, ShieldCheck, Trash2 } from 'lucide-react';

interface Props {
  showListPanel: boolean;
  inert?: boolean;
}

export function BottomTabBar({ showListPanel, inert }: Props) {
  const tabs: Array<{
    to: '/' | '/health' | '/trash' | '/settings';
    label: string;
    Icon: typeof KeyRound;
    manualActive?: boolean;
  }> = [
    { to: '/', label: 'Vault', Icon: KeyRound, manualActive: showListPanel },
    { to: '/health', label: 'Health', Icon: ShieldCheck },
    { to: '/trash', label: 'Trash', Icon: Trash2 },
    { to: '/settings', label: 'Settings', Icon: Settings },
  ];

  return (
    <nav
      data-testid="bottom-tab-bar"
      className="w-full bg-card border-t border-border flex shrink-0"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)', minHeight: '60px' }}
      aria-label="Primary"
      inert={inert || undefined}
    >
      {tabs.map(({ to, label, Icon, manualActive }) => (
        <Link
          key={to}
          to={to}
          className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${
            manualActive !== undefined
              ? manualActive
                ? 'text-primary'
                : 'text-muted-foreground'
              : 'text-muted-foreground [&.active]:text-primary'
          }`}
          activeOptions={{ exact: to === '/' }}
        >
          <Icon className="w-5 h-5" />
          <span className="text-[10px] font-bold tracking-[0.08em] uppercase">{label}</span>
        </Link>
      ))}
    </nav>
  );
}
