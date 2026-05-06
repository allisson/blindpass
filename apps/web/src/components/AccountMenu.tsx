import { Link } from '@tanstack/react-router';
import {
  ChevronRight,
  Lock,
  LogOut,
  Monitor,
  Moon,
  Shield,
  Settings as SettingsIcon,
  Sun,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';

type Theme = 'light' | 'dark' | 'system';

interface Props {
  username: string;
  theme: Theme;
  onThemeChange: (t: Theme) => void;
  onLock: () => void;
  onSignOutRequested: () => void;
  isAdmin: boolean;
}

const THEME_OPTIONS: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
];

export function AccountMenu({
  username,
  theme,
  onThemeChange,
  onLock,
  onSignOutRequested,
  isAdmin,
}: Props) {
  const initial = username.charAt(0).toUpperCase() || '?';

  return (
    <Popover>
      <PopoverTrigger
        data-testid="account-menu-trigger"
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-accent/40 transition-colors text-left min-w-0"
        aria-label="Account menu"
      >
        <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
          <span className="text-[11px] font-semibold text-primary uppercase">{initial}</span>
        </div>
        <span className="flex-1 min-w-0 leading-tight">
          <span className="block text-[11px] font-medium text-foreground truncate">{username}</span>
          <span className="block text-[10px] text-muted-foreground/70">Account</span>
        </span>
        <ChevronRight className="w-3 h-3 text-muted-foreground/60 shrink-0" />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="top"
        sideOffset={8}
        className="w-60 p-1.5"
        data-testid="account-menu-content"
      >
        <div className="px-2 py-1.5">
          <p className="text-[11px] text-muted-foreground/70 leading-tight">Signed in as</p>
          <p className="text-xs font-medium text-foreground truncate" title={username}>
            {username}
          </p>
        </div>
        <Separator className="my-1" />
        <div className="px-2 py-1.5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-1.5">
            Theme
          </p>
          <div
            className="grid grid-cols-3 gap-1 p-0.5 rounded-md bg-muted/50"
            role="radiogroup"
            aria-label="Theme"
          >
            {THEME_OPTIONS.map(({ value, label, Icon }) => {
              const active = theme === value;
              return (
                <button
                  key={value}
                  role="radio"
                  aria-checked={active}
                  data-testid={`account-menu-theme-${value}`}
                  onClick={() => onThemeChange(value)}
                  className={`flex flex-col items-center gap-0.5 py-1 rounded text-[10px] transition-colors ${
                    active
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title={label}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <Separator className="my-1" />
        <Link
          to="/settings"
          className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-foreground hover:bg-accent active:bg-accent transition-colors"
        >
          <SettingsIcon className="w-3.5 h-3.5 text-muted-foreground" />
          Settings
        </Link>
        {isAdmin && (
          <Link
            to="/admin"
            className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-foreground hover:bg-accent active:bg-accent transition-colors"
          >
            <Shield className="w-3.5 h-3.5 text-muted-foreground" />
            Admin
          </Link>
        )}
        <button
          data-testid="account-menu-lock"
          onClick={onLock}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-foreground hover:bg-accent active:bg-accent transition-colors"
        >
          <Lock className="w-3.5 h-3.5 text-muted-foreground" />
          Lock vault
        </button>
        <Separator className="my-1" />
        <button
          data-testid="account-menu-sign-out"
          onClick={onSignOutRequested}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-destructive hover:bg-destructive/10 active:bg-destructive/10 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </PopoverContent>
    </Popover>
  );
}
