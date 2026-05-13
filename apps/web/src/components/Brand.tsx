interface GlyphProps {
  className?: string;
  ariaLabel?: string;
}

export function BrandGlyph({ className, ariaLabel }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role={ariaLabel ? 'img' : 'presentation'}
      aria-label={ariaLabel}
    >
      <circle cx="16" cy="16" r="14" stroke="#7c4dff" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="9" stroke="#7c4dff" strokeWidth="1.25" opacity="0.5" />
      <circle cx="16" cy="16" r="4.5" fill="#7c4dff" />
      <circle cx="14.5" cy="14.5" r="1.5" fill="white" opacity="0.85" />
    </svg>
  );
}

interface LockupProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'horizontal' | 'stacked';
}

export function BrandLockup({ className = '', size = 'md', variant = 'horizontal' }: LockupProps) {
  const glyphSizes = { sm: 'w-5 h-5', md: 'w-7 h-7', lg: 'w-10 h-10' };
  const wordSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-2xl',
  };
  return (
    <div
      className={`flex ${variant === 'stacked' ? 'flex-col items-center gap-2' : 'items-center gap-2.5'} ${className}`}
    >
      <BrandGlyph className={`${glyphSizes[size]} text-foreground`} ariaLabel="BlindPass" />
      <span
        className={`font-heading font-semibold tracking-tight text-foreground ${wordSizes[size]}`}
      >
        Blind<span className="text-primary">Pass</span>
      </span>
    </div>
  );
}
