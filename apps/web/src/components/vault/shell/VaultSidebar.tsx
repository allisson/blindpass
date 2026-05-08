import { Link } from '@tanstack/react-router';
import {
  Command,
  KeyRound,
  MonitorSmartphone,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  User,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { BrandGlyph } from '@/components/Brand';
import { Separator } from '@/components/ui/separator';
import { SyncStatusBar } from '@/components/SyncStatusBar';
import { NAV_LINK_CLASS } from './navLinkClass';

interface Props {
  trashCount: number;
  vaultPicker: ReactNode;
  accountMenu: ReactNode;
  onOpenCommandPalette: () => void;
  onOpenVaultSheet: () => void;
}

export function VaultSidebar({
  trashCount,
  vaultPicker,
  accountMenu,
  onOpenCommandPalette,
  onOpenVaultSheet,
}: Props) {
  return (
    <aside className="hidden md:flex md:w-14 lg:w-52 shrink-0 border-r glass-panel flex-col">
      <div className="px-0 lg:px-4 pt-5 pb-4 flex items-center justify-center lg:justify-start gap-2.5">
        <BrandGlyph className="w-7 h-7 text-foreground shrink-0" ariaLabel="BlindPass" />
        <span className="hidden lg:inline font-heading font-semibold text-sm tracking-tight text-foreground">
          Blind<span className="text-primary">Pass</span>
        </span>
      </div>
      <Separator />
      <div className="hidden lg:block">
        {vaultPicker}
        <Separator />
      </div>
      <div className="px-2 pt-2 hidden lg:block">
        <button
          type="button"
          data-testid="open-command-palette"
          onClick={onOpenCommandPalette}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border/60 text-xs text-muted-foreground hover:text-foreground hover:border-border bg-background/40 transition-colors"
          aria-label="Open command palette"
        >
          <Search className="w-3 h-3" />
          <span className="flex-1 text-left">Search…</span>
          <kbd className="font-mono text-[10px] border border-border/60 rounded px-1 py-px flex items-center gap-0.5">
            <Command className="w-2.5 h-2.5" />K
          </kbd>
        </button>
      </div>
      <div className="lg:hidden px-2 pt-2">
        <button
          type="button"
          data-testid="open-command-palette-icon"
          onClick={onOpenCommandPalette}
          aria-label="Open command palette"
          className="w-full flex items-center justify-center py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
        >
          <Search className="w-4 h-4" />
        </button>
      </div>
      <div className="md:block lg:hidden px-2 pb-2">
        <button
          type="button"
          onClick={onOpenVaultSheet}
          className="w-full flex items-center justify-center py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
          aria-label="Account and vaults"
        >
          <User className="w-4 h-4" />
        </button>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        <Link to="/" className={NAV_LINK_CLASS} title="Vault" aria-label="Vault">
          <KeyRound className="w-4 h-4" />
          <span className="hidden lg:inline">Vault</span>
        </Link>
        <Link to="/health" className={NAV_LINK_CLASS} title="Health" aria-label="Health">
          <ShieldCheck className="w-4 h-4" />
          <span className="hidden lg:inline">Health</span>
        </Link>
        <Link to="/trash" className={NAV_LINK_CLASS} title="Trash" aria-label="Trash">
          <Trash2 className="w-4 h-4" />
          <span className="hidden lg:inline flex-1">Trash</span>
          {trashCount > 0 && (
            <span
              data-testid="trash-count-badge"
              className="text-[10px] font-mono font-medium px-1.5 py-px rounded-full bg-muted text-muted-foreground"
            >
              {trashCount}
            </span>
          )}
        </Link>
        <Link to="/settings" className={NAV_LINK_CLASS} title="Settings" aria-label="Settings">
          <Settings className="w-4 h-4" />
          <span className="hidden lg:inline">Settings</span>
        </Link>
        <Link to="/sessions" className={NAV_LINK_CLASS} title="Sessions" aria-label="Sessions">
          <MonitorSmartphone className="w-4 h-4" />
          <span className="hidden lg:inline">Sessions</span>
        </Link>
      </nav>
      <div className="hidden lg:block">
        <SyncStatusBar />
        <Separator />
      </div>
      <div className="hidden lg:block">{accountMenu}</div>
    </aside>
  );
}
