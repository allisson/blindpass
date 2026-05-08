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
    return <p className="text-xs text-muted-foreground">Unlock your vault to view.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="rounded-md bg-muted/40 border border-border p-3 font-mono text-xs leading-relaxed break-words">
        {id}
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
