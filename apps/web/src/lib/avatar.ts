const AVATAR_COLORS = [
  'oklch(0.62 0.18 295)', // violet
  'oklch(0.65 0.16 195)', // teal
  'oklch(0.64 0.19 230)', // cyan-blue
  'oklch(0.66 0.17 155)', // emerald
  'oklch(0.63 0.18 30)', // rose-orange
  'oklch(0.66 0.16 260)', // indigo
  'oklch(0.67 0.15 170)', // green-teal
  'oklch(0.64 0.19 320)', // pink-violet
] as const;

export function getAvatarColor(title: string): string {
  const hash = title.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function getInitial(title: string): string {
  return title.trim().charAt(0).toUpperCase() || '?';
}

export function withAlpha(color: string, alpha: number): string {
  return color.slice(0, -1) + ` / ${alpha})`;
}
