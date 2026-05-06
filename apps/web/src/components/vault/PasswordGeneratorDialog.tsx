import { wordlist } from '@scure/bip39/wordlists/english.js';
import { Copy, RefreshCw, Wand2 } from 'lucide-react';
import { MIN_PASSWORD_LENGTH } from '@/lib/constants';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

// ── generation ────────────────────────────────────────────────────────────────

function buildCharset(opts: {
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  special: boolean;
}): string {
  let c = '';
  if (opts.uppercase) c += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (opts.lowercase) c += 'abcdefghijklmnopqrstuvwxyz';
  if (opts.numbers) c += '0123456789';
  if (opts.special) c += '!@#$%^&*()_+-=[]{}|;:,.<>?';
  return c || 'abcdefghijklmnopqrstuvwxyz';
}

function genPassword(opts: {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  special: boolean;
}): string {
  const charset = buildCharset(opts);
  const buf = new Uint32Array(opts.length);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((n) => charset[n % charset.length])
    .join('');
}

function genPassphrase(opts: {
  wordCount: number;
  separator: string;
  capitalize: boolean;
  includeNumber: boolean;
}): string {
  const buf = new Uint32Array(opts.wordCount);
  crypto.getRandomValues(buf);
  const words = Array.from(buf).map((i) => {
    const w = wordlist[i % wordlist.length];
    return opts.capitalize ? w[0].toUpperCase() + w.slice(1) : w;
  });
  if (opts.includeNumber) {
    const n = new Uint32Array(1);
    crypto.getRandomValues(n);
    words.push(String(n[0] % 100));
  }
  return words.join(opts.separator);
}

// ── strength ──────────────────────────────────────────────────────────────────

type Strength = 'Weak' | 'Fair' | 'Good' | 'Strong';

function calcEntropy(
  mode: 'password' | 'passphrase',
  opts: {
    length: number;
    uppercase: boolean;
    lowercase: boolean;
    numbers: boolean;
    special: boolean;
    wordCount: number;
  },
): number {
  if (mode === 'passphrase') return opts.wordCount * Math.log2(2048);
  const charsetSize = buildCharset(opts).length;
  return opts.length * Math.log2(charsetSize);
}

function getStrength(bits: number): Strength {
  if (bits < 40) return 'Weak';
  if (bits < 60) return 'Fair';
  if (bits < 80) return 'Good';
  return 'Strong';
}

const STRENGTH_STYLE: Record<Strength, { bar: string; text: string }> = {
  Weak: { bar: 'bg-destructive', text: 'text-destructive' },
  Fair: { bar: 'bg-amber-500', text: 'text-amber-500' },
  Good: { bar: 'bg-[var(--accent-teal)]', text: 'text-[var(--accent-teal)]' },
  Strong: { bar: 'bg-primary', text: 'text-primary' },
};

// ── component ─────────────────────────────────────────────────────────────────

interface Props {
  onUse: (password: string) => void;
}

export function PasswordGeneratorDialog({ onUse }: Props) {
  const [open, setOpen] = useState(false);

  // password options
  const [length, setLength] = useState(20);
  const [uppercase, setUppercase] = useState(true);
  const [lowercase, setLowercase] = useState(true);
  const [numbers, setNumbers] = useState(true);
  const [special, setSpecial] = useState(true);

  // passphrase options
  const [wordCount, setWordCount] = useState(4);
  const [separator, setSeparator] = useState('-');
  const [capitalize, setCapitalize] = useState(true);
  const [includeNumber, setIncludeNumber] = useState(false);

  const [mode, setMode] = useState<'password' | 'passphrase'>('password');
  const [generated, setGenerated] = useState('');
  const [copied, setCopied] = useState(false);

  function regenerate() {
    if (mode === 'password') {
      setGenerated(genPassword({ length, uppercase, lowercase, numbers, special }));
    } else {
      setGenerated(genPassphrase({ wordCount, separator, capitalize, includeNumber }));
    }
  }

  // regenerate whenever options change or dialog opens
  useEffect(() => {
    if (open) regenerate();
  }, [
    open,
    mode,
    length,
    uppercase,
    lowercase,
    numbers,
    special,
    wordCount,
    separator,
    capitalize,
    includeNumber,
  ]);

  async function handleCopy() {
    await navigator.clipboard.writeText(generated);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleUse() {
    onUse(generated);
    setOpen(false);
  }

  const entropy = calcEntropy(mode, { length, uppercase, lowercase, numbers, special, wordCount });
  const strength = getStrength(entropy);
  const { bar: barColor, text: textColor } = STRENGTH_STYLE[strength];
  const barWidth = Math.min(100, (entropy / 100) * 100);

  const SEPARATORS = [
    { label: '–', value: '-' },
    { label: '_', value: '_' },
    { label: '·', value: ' ' },
    { label: '.', value: '.' },
    { label: '/', value: '/' },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0"
            aria-label="Open password generator"
          />
        }
      >
        <Wand2 className="w-4 h-4" />
      </DialogTrigger>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-4 h-4 opacity-70" />
            Password Generator
          </DialogTitle>
        </DialogHeader>

        {/* mode toggle */}
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {(['password', 'passphrase'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                mode === m
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {/* preview */}
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-lg border border-input bg-muted/30 px-3 py-2.5 font-mono text-sm break-all leading-relaxed">
            {generated || '…'}
          </div>
          <button
            type="button"
            onClick={regenerate}
            className="shrink-0 rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Regenerate"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* strength bar */}
        <div className="space-y-1">
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${barColor}`}
              style={{ width: `${barWidth}%` }}
            />
          </div>
          <p className={`text-xs font-medium ${textColor}`}>
            {strength} · {Math.round(entropy)} bits
          </p>
        </div>

        {/* options */}
        {mode === 'password' ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs text-muted-foreground">Length</label>
                <span className="text-xs font-mono font-medium">{length}</span>
              </div>
              <input
                type="range"
                min={MIN_PASSWORD_LENGTH}
                max={128}
                value={length}
                onChange={(e) => setLength(Number(e.target.value))}
                className="w-full cursor-pointer accent-[var(--primary)]"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Uppercase (A–Z)', value: uppercase, set: setUppercase },
                { label: 'Lowercase (a–z)', value: lowercase, set: setLowercase },
                { label: 'Numbers (0–9)', value: numbers, set: setNumbers },
                { label: 'Special (!@#…)', value: special, set: setSpecial },
              ].map(({ label, value, set }) => (
                <label key={label} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => set(e.target.checked)}
                    className="w-4 h-4 cursor-pointer accent-[var(--primary)] rounded"
                  />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </label>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs text-muted-foreground">Words</label>
                <span className="text-xs font-mono font-medium">{wordCount}</span>
              </div>
              <input
                type="range"
                min={3}
                max={10}
                value={wordCount}
                onChange={(e) => setWordCount(Number(e.target.value))}
                className="w-full cursor-pointer accent-[var(--primary)]"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Separator</p>
              <div className="flex gap-1.5">
                {SEPARATORS.map(({ label, value }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSeparator(value)}
                    className={`w-9 h-8 rounded-md text-sm font-mono transition-colors ${
                      separator === value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-4">
              {[
                { label: 'Capitalize', value: capitalize, set: setCapitalize },
                { label: 'Include number', value: includeNumber, set: setIncludeNumber },
              ].map(({ label, value, set }) => (
                <label key={label} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => set(e.target.checked)}
                    className="w-4 h-4 cursor-pointer accent-[var(--primary)] rounded"
                  />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <DialogFooter showCloseButton={false}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="gap-1.5"
          >
            <Copy className="w-3.5 h-3.5" />
            {copied ? 'Copied!' : 'Copy'}
          </Button>
          <Button type="button" size="sm" onClick={handleUse}>
            Use Password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
