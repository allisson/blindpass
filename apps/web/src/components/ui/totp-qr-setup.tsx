import { useState } from 'react';
import { QRCode } from 'react-qr-code';
import { Check, Copy } from 'lucide-react';

interface TotpQrSetupProps {
  otpauthUri: string;
  setupKey: string;
}

export function TotpQrSetup({ otpauthUri, setupKey }: TotpQrSetupProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(setupKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Scan with your authenticator app
        </p>
        <div className="flex justify-center">
          <div className="bg-white rounded-lg p-3" aria-label="TOTP QR code">
            <QRCode value={otpauthUri} size={160} />
          </div>
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Manual setup key
        </p>
        <div className="relative">
          <p
            data-testid="setup-key"
            className="font-mono text-xs leading-relaxed rounded-md border border-border bg-muted/40 p-3 pr-9 break-all"
          >
            {setupKey}
          </p>
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy setup key"
            className="absolute right-2 top-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
