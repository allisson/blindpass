export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'bp:theme';

export function loadTheme(): Theme {
  const v = localStorage.getItem(STORAGE_KEY);
  if (v === 'light' || v === 'dark') return v;
  return 'system';
}

export function applyTheme(t: Theme) {
  const dark =
    t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  if (t === 'system') localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, t);
}

export function isDark(): boolean {
  return document.documentElement.classList.contains('dark');
}
