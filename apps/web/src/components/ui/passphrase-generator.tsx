import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Sparkles } from 'lucide-react';
import { generatePassphrase } from '@/lib/passphrase';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const WORD_OPTIONS = [6, 7, 8] as const;
type WordCount = (typeof WORD_OPTIONS)[number];

type PassphraseGeneratorProps = {
  onAccept: (passphrase: string) => void;
  className?: string;
};

export function PassphraseGenerator({ onAccept, className }: PassphraseGeneratorProps) {
  const [words, setWords] = useState<WordCount>(7);
  const [phrase, setPhrase] = useState<string | null>(null);

  function roll(count: WordCount = words) {
    setPhrase(generatePassphrase(count));
  }

  function handleWordsChange(next: WordCount) {
    setWords(next);
    if (phrase) setPhrase(generatePassphrase(next));
  }

  return (
    <div className={cn('flex flex-col gap-2', className)} data-testid="passphrase-generator">
      <div className="flex items-center gap-2 flex-wrap">
        <Button type="button" variant="outline" size="xs" onClick={() => roll()}>
          {phrase ? (
            <>
              <RefreshCw aria-hidden="true" />
              Reroll
            </>
          ) : (
            <>
              <Sparkles aria-hidden="true" />
              Generate passphrase
            </>
          )}
        </Button>
        <div
          role="radiogroup"
          aria-label="Word count"
          className="inline-flex items-center rounded-md border border-border p-0.5 text-[10px] uppercase tracking-[0.08em] text-muted-foreground"
        >
          {WORD_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={words === n}
              onClick={() => handleWordsChange(n)}
              className={cn(
                'px-2 py-0.5 rounded-sm transition-colors',
                words === n
                  ? 'bg-muted text-foreground'
                  : 'hover:text-foreground/80 cursor-pointer',
              )}
            >
              {n}w
            </button>
          ))}
        </div>
      </div>
      <AnimatePresence>
        {phrase && (
          <motion.div
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-1.5 rounded-md border border-border bg-muted/40 p-2.5">
              <code
                data-testid="passphrase-value"
                className="font-mono text-sm text-foreground break-all select-all"
              >
                {phrase}
              </code>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                  ≈ {Math.round(words * 11)} bits of entropy
                </span>
                <Button type="button" variant="default" size="xs" onClick={() => onAccept(phrase)}>
                  Use this
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
