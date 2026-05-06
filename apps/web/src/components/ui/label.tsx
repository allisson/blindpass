import * as React from 'react';

import { cn } from '@/lib/utils';

type LabelProps = React.ComponentProps<'label'> & {
  optional?: boolean;
  hint?: string;
};

function Label({ className, children, optional, hint, ...props }: LabelProps) {
  return (
    <label
      data-slot="label"
      className={cn(
        'inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] leading-none text-muted-foreground select-none transition-colors',
        'group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <span>{children}</span>
      {optional && (
        <span className="font-normal normal-case tracking-normal text-[10px] text-muted-foreground/60">
          — optional
        </span>
      )}
      {hint && (
        <span
          aria-label={hint}
          title={hint}
          className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-border text-[9px] font-normal normal-case tracking-normal text-muted-foreground/70 cursor-help"
        >
          ?
        </span>
      )}
    </label>
  );
}

export { Label };
