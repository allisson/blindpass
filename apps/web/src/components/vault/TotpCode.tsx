import { generateTotpCode, getTotpTimeRemaining } from '@blindpass/crypto';
import { Check, Copy } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { TotpItem } from '@blindpass/vault';

interface Props {
  item: TotpItem;
}

const RING_R = 18;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R;

function formatCode(code: string): string {
  const mid = Math.ceil(code.length / 2);
  return `${code.slice(0, mid)} ${code.slice(mid)}`;
}

export function TotpCode({ item }: Props) {
  const [code, setCode] = useState('');
  const [remaining, setRemaining] = useState(item.period);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(() => {
    setCode(
      generateTotpCode(item.secret, {
        algorithm: item.algorithm,
        digits: item.digits,
        period: item.period,
      }),
    );
    setRemaining(getTotpTimeRemaining(item.period));
  }, [item.secret, item.algorithm, item.digits, item.period]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    setCopied(false);
  }, [code]);

  async function handleCopy() {
    if (!code) return;
    await navigator.clipboard.writeText(code.replace(' ', ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  const progress = remaining / item.period;
  const dashOffset = RING_CIRCUMFERENCE * (1 - progress);
  const ringColor =
    remaining <= 5 ? 'text-destructive' : remaining <= 10 ? 'text-yellow-500' : 'text-primary';
  const urgentGlow =
    remaining <= 5 ? { filter: 'drop-shadow(0 0 10px oklch(0.628 0.24 22 / 0.7))' } : {};

  return (
    <div className="flex flex-col items-center gap-3 py-6">
      {(item.issuer || item.accountName) && (
        <p className="text-xs text-muted-foreground text-center">
          {[item.issuer, item.accountName].filter(Boolean).join(' · ')}
        </p>
      )}

      <button
        type="button"
        onClick={handleCopy}
        className="relative flex items-center justify-center w-36 h-36 group cursor-pointer"
        aria-label={`Copy TOTP code. ${remaining} seconds remaining`}
        title="Click to copy"
      >
        {/* Countdown ring */}
        <svg
          className="absolute inset-0 w-full h-full -rotate-90"
          viewBox="0 0 48 48"
          style={urgentGlow}
        >
          {/* Track */}
          <circle
            cx="24"
            cy="24"
            r={RING_R}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="text-border"
          />
          {/* Progress */}
          <circle
            cx="24"
            cy="24"
            r={RING_R}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            className={`transition-all duration-1000 ease-linear ${ringColor}`}
          />
        </svg>

        {/* Code */}
        <span className="relative font-mono text-3xl font-bold tracking-widest text-foreground group-hover:text-primary transition-colors select-none">
          {code ? formatCode(code) : '––––––'}
        </span>
      </button>

      <p className="text-xs text-muted-foreground flex items-center gap-1.5" aria-hidden="true">
        {copied ? (
          <>
            <Check className="w-3 h-3 text-primary" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="w-3 h-3" />
            {remaining}s
          </>
        )}
      </p>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? 'TOTP code copied to clipboard' : ''}
      </span>
    </div>
  );
}
