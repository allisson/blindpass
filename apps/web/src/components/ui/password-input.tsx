import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from './input';
import { cn } from '@/lib/utils';

type Props = Omit<React.ComponentProps<'input'>, 'type'> & {
  defaultRevealed?: boolean;
  revealed?: boolean;
  onRevealChange?: (revealed: boolean) => void;
};

function PasswordInput({
  className,
  disabled,
  defaultRevealed = false,
  revealed: revealedProp,
  onRevealChange,
  ...props
}: Props) {
  const [internal, setInternal] = useState(defaultRevealed);
  const isControlled = revealedProp !== undefined;
  const revealed = isControlled ? revealedProp : internal;
  const toggle = () => {
    const next = !revealed;
    if (!isControlled) setInternal(next);
    onRevealChange?.(next);
  };
  return (
    <div className="relative">
      <Input
        type={revealed ? 'text' : 'password'}
        className={cn('pr-9 font-mono tracking-[0.06em]', className)}
        disabled={disabled}
        {...props}
      />
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-label={revealed ? 'Hide password' : 'Show password'}
        aria-pressed={revealed}
        className="absolute right-1 top-1/2 -translate-y-1/2 grid place-items-center w-7 h-7 rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50"
      >
        {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

export { PasswordInput };
