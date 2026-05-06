export type Density = 'compact' | 'cozy';

const STORAGE_KEY = 'bp:density';
const DEFAULT_DENSITY: Density = 'cozy';

export function loadDensity(): Density {
  const v = localStorage.getItem(STORAGE_KEY);
  return v === 'compact' || v === 'cozy' ? v : DEFAULT_DENSITY;
}

export function applyDensity(d: Density) {
  document.documentElement.setAttribute('data-density', d);
  if (d === DEFAULT_DENSITY) localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, d);
}
