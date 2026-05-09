import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { verificationId } from '@blindpass/crypto';
import { Button } from '@/components/ui/button';
import { session } from '@/lib/session';

export function VerificationIdSection() {
  const [id, setId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const pk = session.get()?.keyPair?.publicKey;
    if (!pk) return;
    void verificationId(pk).then(setId);
  }, []);

  async function handleCopy() {
    if (!id) return;
    await navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!id) {
    return <p className="text-sm text-muted-foreground">Unlock your vault to view.</p>;
  }

  const words = id.split(/\s+/).filter(Boolean);

  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-muted/40 border border-border p-4" aria-label="Verification ID">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 font-mono text-sm leading-relaxed text-foreground tracking-[0.06em]">
          {words.map((word, i) => (
            <span key={`${i}-${word}`} className="flex items-baseline gap-2">
              <span className="text-muted-foreground/60 tabular-nums w-5 text-right select-none">
                {i + 1}
              </span>
              <span>{word}</span>
            </span>
          ))}
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={() => void handleCopy()}>
        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        {copied ? 'Copied' : 'Copy'}
      </Button>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? 'Verification ID copied to clipboard' : ''}
      </span>
    </div>
  );
}
