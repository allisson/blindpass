const AVATAR_COLORS = [
  'oklch(0.62 0.18 295)', // violet
  'oklch(0.60 0.14 260)', // indigo
  'oklch(0.60 0.13 280)', // blue-violet
  'oklch(0.60 0.17 310)', // pink-violet
  'oklch(0.60 0.15 290)', // blue-purple
  'oklch(0.58 0.10 270)', // slate-indigo
  'oklch(0.64 0.16 305)', // lavender
  'oklch(0.62 0.12 250)', // blue-slate
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
