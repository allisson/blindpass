import { CreditCard, FileText, Key, Shield, User, Wallet } from 'lucide-react';
import { getAvatarColor, getInitial, withAlpha } from '@/lib/avatar';
import type { DecryptedItem } from '@/hooks/useVault';

interface Props {
  item: Pick<DecryptedItem, 'type' | 'title'>;
  size?: 'sm' | 'lg';
}

export function ItemAvatar({ item, size = 'sm' }: Props) {
  const color = getAvatarColor(item.title);
  const initial = getInitial(item.title);
  const isLg = size === 'lg';

  const wrapperCls = isLg
    ? 'w-[72px] h-[72px] rounded-[6px] text-[28px] font-bold'
    : 'w-10 h-10 rounded text-[15px] font-bold';
  const badgeCls = isLg
    ? 'absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded'
    : 'absolute -bottom-1 -right-1 w-4 h-4 rounded';
  const iconCls = isLg ? 'w-3 h-3' : 'w-2.5 h-2.5';

  return (
    <div
      className={`relative ${wrapperCls} flex items-center justify-center shrink-0 select-none`}
      style={{
        background: withAlpha(color, isLg ? 0.18 : 0.15),
        border: `1px solid ${withAlpha(color, isLg ? 0.35 : 0.3)}`,
        color,
      }}
    >
      {initial}
      {item.type !== 'login' && (
        <span
          className={`${badgeCls} bg-background border border-border flex items-center justify-center`}
        >
          {item.type === 'secure_note' && (
            <FileText className={`${iconCls} text-muted-foreground`} />
          )}
          {item.type === 'payment_card' && (
            <CreditCard className={`${iconCls} text-muted-foreground`} />
          )}
          {item.type === 'identity' && <User className={`${iconCls} text-muted-foreground`} />}
          {item.type === 'totp' && <Shield className={`${iconCls} text-muted-foreground`} />}
          {item.type === 'developer_credential' && (
            <Key className={`${iconCls} text-muted-foreground`} />
          )}
          {item.type === 'crypto_wallet' && (
            <Wallet className={`${iconCls} text-muted-foreground`} />
          )}
        </span>
      )}
    </div>
  );
}
