import { Monitor, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { applyTheme, loadTheme } from '@/lib/theme';

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
] as const;

export function AppearanceSection() {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => loadTheme());

  function handleTheme(t: 'light' | 'dark' | 'system') {
    setTheme(t);
    applyTheme(t);
    window.dispatchEvent(new CustomEvent('bp:theme-change', { detail: t }));
  }

  return (
    <div className="flex gap-2" role="radiogroup" aria-label="Color theme">
      {THEME_OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          role="radio"
          aria-checked={theme === value}
          onClick={() => handleTheme(value)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
            theme === value
              ? 'bg-accent border-border text-foreground'
              : 'border-border text-muted-foreground hover:bg-accent/60 hover:text-foreground'
          }`}
        >
          <Icon className="w-3.5 h-3.5" aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}
