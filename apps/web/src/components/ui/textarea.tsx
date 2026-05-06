import { cn } from '@/lib/utils';
import { type ComponentProps } from 'react';

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'h-auto w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm transition-all outline-none placeholder:text-muted-foreground focus-visible:border-ring disabled:pointer-events-none disabled:cursor-not-allowed dark:bg-input/20',
        className,
      )}
      {...props}
    />
  );
}
