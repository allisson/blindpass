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
      <defs>
        <linearGradient id="bp-iris-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="oklch(0.58 0.21 295)" />
          <stop offset="100%" stopColor="oklch(0.72 0.155 195)" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="14" stroke="url(#bp-iris-grad)" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="9" stroke="currentColor" strokeWidth="1.25" opacity="0.7" />
      <circle cx="16" cy="16" r="4.5" fill="url(#bp-iris-grad)" />
      <circle cx="14.5" cy="14.5" r="1.5" fill="oklch(0.99 0.002 265)" opacity="0.85" />
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
