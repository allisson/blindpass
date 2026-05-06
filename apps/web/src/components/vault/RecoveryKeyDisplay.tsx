import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  mnemonic: string;
}

export function RecoveryKeyDisplay({ mnemonic }: Props) {
  const [copied, setCopied] = useState(false);
  const words = mnemonic.split(' ');

  async function handleCopy() {
    await navigator.clipboard.writeText(mnemonic);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-muted border border-border p-4">
        <div className="grid grid-cols-3 gap-2">
          {words.map((word, i) => (
            <div key={i} className="flex items-center gap-1.5 text-sm font-mono">
              <span className="text-muted-foreground text-xs w-5 text-right shrink-0">
                {i + 1}.
              </span>
              <span className="text-foreground" data-testid="recovery-word">
                {word}
              </span>
            </div>
          ))}
        </div>
      </div>
      <Button variant="outline" size="sm" className="w-full gap-2" onClick={handleCopy}>
        {copied ? (
          <>
            <Check className="w-4 h-4 text-primary" />
            Copied
          </>
        ) : (
          <>
            <Copy className="w-4 h-4" />
            Copy to clipboard
          </>
        )}
      </Button>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? 'Recovery key copied to clipboard' : ''}
      </span>
    </div>
  );
}
