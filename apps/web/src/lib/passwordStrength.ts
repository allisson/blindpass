import { MIN_PASSWORD_LENGTH } from './constants';

export function passwordStrength(p: string): number {
  if (!p) return 0;
  let score = 0;
  if (p.length >= MIN_PASSWORD_LENGTH) score++;
  if (p.length >= MIN_PASSWORD_LENGTH + 4) score++;
  if (/[A-Z]/.test(p) && /[0-9]/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;
  return score;
}

export const strengthColors = [
  'bg-muted',
  'bg-destructive',
  'bg-amber-500',
  'bg-[var(--accent-teal)]',
  'bg-primary',
] as const;

export const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong'] as const;
