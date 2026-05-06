import { Link } from '@tanstack/react-router';
import { Check, Copy } from 'lucide-react';
import { memo, useState } from 'react';
import { toast } from 'sonner';
import { generateTotpCode } from '@blindpass/crypto';
import { getAvatarColor, withAlpha } from '@/lib/avatar';
import type { DecryptedItem } from '@/hooks/useVault';
import { ItemAvatar } from './ItemAvatar';

interface Props {
  item: DecryptedItem;
  isWeak?: boolean;
  isReused?: boolean;
}

export function getItemSubtitle(item: { type: string; [key: string]: unknown }): string {
  switch (item.type) {
    case 'login':
      return String(item.username ?? '');
    case 'secure_note': {
      const c = String(item.content ?? '');
      return c.slice(0, 40) + (c.length > 40 ? '…' : '');
    }
    case 'payment_card':
      return String(item.cardholderName ?? '');
    case 'identity':
      return `${item.firstName ?? ''} ${item.lastName ?? ''}`.trim();
    case 'totp':
      return [item.issuer, item.accountName].filter(Boolean).join(' · ') || 'Authenticator';
    case 'developer_credential':
      return item.credentialMode === 'ssh_key'
        ? [item.username, item.host].filter(Boolean).join(' @ ')
        : [item.provider, item.environment].filter(Boolean).join(' · ');
    case 'crypto_wallet': {
      if (item.walletMode !== 'bip39') return '';
      const wordCount = String(item.mnemonic ?? '')
        .trim()
        .split(/\s+/).length;
      const primary = String(item.walletName ?? item.addressHint ?? `${wordCount}-word seed`);
      return item.network ? `${item.network} · ${primary}` : primary;
    }
    default:
      return '';
  }
}

export const ItemCard = memo(function ItemCard({ item, isWeak, isReused }: Props) {
  const [copied, setCopied] = useState(false);
  const color = getAvatarColor(item.title);

  async function handleCopy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    let text: string | null = null;
    if (item.type === 'login') text = item.password;
    if (item.type === 'totp') {
      text = generateTotpCode(item.secret, {
        algorithm: item.algorithm,
        digits: item.digits,
        period: item.period,
      });
    }
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(item.type === 'totp' ? 'Code copied' : 'Password copied');
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Link
      to="/$itemId"
      params={{ itemId: item.id }}
      activeProps={{
        className: 'text-foreground',
        style: {
          background: withAlpha(color, 0.1),
          boxShadow: `inset 2px 0 0 ${color}`,
        },
      }}
      style={{ paddingTop: 'var(--row-py)', paddingBottom: 'var(--row-py)' }}
      className="flex items-center gap-3 px-3 rounded-lg hover:bg-accent/40 transition-colors group"
    >
      <ItemAvatar item={item} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
          {(isWeak || isReused) && (
            <span className="flex items-center gap-1 shrink-0">
              {isWeak && (
                <span
                  className="w-1.5 h-1.5 rounded-full bg-destructive"
                  title="Weak password"
                  aria-label="Weak password"
                />
              )}
              {isReused && (
                <span
                  className="w-1.5 h-1.5 rounded-full bg-[oklch(0.65_0.16_60)]"
                  title="Reused password"
                  aria-label="Reused password"
                />
              )}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{getItemSubtitle(item)}</p>
      </div>
      {(item.type === 'login' || item.type === 'totp') && (
        <button
          onClick={handleCopy}
          className={`p-2 lg:p-1 rounded transition-all duration-150 shrink-0 flex items-center justify-center touch-manipulation ${
            copied
              ? 'text-primary bg-primary/10 scale-110'
              : 'text-muted-foreground/50 hover:text-foreground hover:bg-background/60 active:bg-background/60 [@media(hover:none)]:text-muted-foreground scale-100'
          }`}
          aria-label={item.type === 'totp' ? 'Copy code' : 'Copy password'}
          title={item.type === 'totp' ? 'Copy code' : 'Copy password'}
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          <span className="sr-only" aria-live="polite">
            {copied ? (item.type === 'totp' ? 'Code copied' : 'Password copied') : ''}
          </span>
        </button>
      )}
    </Link>
  );
});
