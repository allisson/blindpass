import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadTheme, applyTheme, isDark } from './theme';

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches,
      media: '(prefers-color-scheme: dark)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    }),
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  stubMatchMedia(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadTheme', () => {
  it('returns "system" when no preference is stored', () => {
    expect(loadTheme()).toBe('system');
  });

  it('returns "light" when stored', () => {
    localStorage.setItem('bp:theme', 'light');
    expect(loadTheme()).toBe('light');
  });

  it('returns "dark" when stored', () => {
    localStorage.setItem('bp:theme', 'dark');
    expect(loadTheme()).toBe('dark');
  });

  it('returns "system" for unknown stored values', () => {
    localStorage.setItem('bp:theme', 'something-else');
    expect(loadTheme()).toBe('system');
  });
});

describe('applyTheme', () => {
  it('adds the dark class for "dark" and persists the value', () => {
    applyTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('bp:theme')).toBe('dark');
  });

  it('removes the dark class for "light" and persists the value', () => {
    document.documentElement.classList.add('dark');
    applyTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('bp:theme')).toBe('light');
  });

  it('uses prefers-color-scheme when "system" and OS prefers dark', () => {
    stubMatchMedia(true);
    applyTheme('system');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('uses prefers-color-scheme when "system" and OS prefers light', () => {
    stubMatchMedia(false);
    document.documentElement.classList.add('dark');
    applyTheme('system');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('removes the storage key when set to "system"', () => {
    localStorage.setItem('bp:theme', 'dark');
    applyTheme('system');
    expect(localStorage.getItem('bp:theme')).toBeNull();
  });
});

describe('isDark', () => {
  it('returns true when the dark class is present', () => {
    document.documentElement.classList.add('dark');
    expect(isDark()).toBe(true);
  });

  it('returns false when the dark class is absent', () => {
    expect(isDark()).toBe(false);
  });
});
