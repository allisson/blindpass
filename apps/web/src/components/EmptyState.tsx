import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  Icon: LucideIcon;
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
  size?: 'sm' | 'md';
  testId?: string;
}

export function EmptyState({
  Icon,
  title,
  hint,
  action,
  className = '',
  size = 'md',
  testId,
}: Props) {
  const padding = size === 'sm' ? 'py-10 px-5' : 'py-14 px-6';
  return (
    <div
      data-testid={testId}
      className={`flex flex-col items-center justify-center text-center gap-3 ${padding} ${className}`}
    >
      <div className="w-10 h-10 rounded-xl bg-muted/60 border border-border flex items-center justify-center">
        <Icon className="w-5 h-5 text-muted-foreground/60" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {hint && <p className="text-xs text-muted-foreground/80 max-w-xs">{hint}</p>}
      </div>
      {action}
    </div>
  );
}
