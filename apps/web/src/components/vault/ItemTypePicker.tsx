import { CreditCard, FileText, Key, Shield, User, Wallet } from 'lucide-react';
import type { VaultItem } from '@blindpass/vault';

const TYPES: {
  type: VaultItem['type'];
  label: string;
  icon: React.ElementType;
  description: string;
}[] = [
  { type: 'login', label: 'Login', icon: Key, description: 'Username, password, and URL' },
  { type: 'secure_note', label: 'Secure Note', icon: FileText, description: 'Encrypted text note' },
  {
    type: 'payment_card',
    label: 'Payment Card',
    icon: CreditCard,
    description: 'Credit or debit card',
  },
  { type: 'identity', label: 'Identity', icon: User, description: 'Personal information' },
  { type: 'totp', label: 'Authenticator', icon: Shield, description: 'TOTP two-factor code' },
  {
    type: 'developer_credential',
    label: 'Developer',
    icon: Key,
    description: 'API tokens, client secrets, and SSH keys',
  },
  {
    type: 'crypto_wallet',
    label: 'Crypto Wallet',
    icon: Wallet,
    description: 'BIP39 seed phrases & wallet metadata',
  },
];

interface Props {
  onSelect: (type: VaultItem['type']) => void;
}

export function ItemTypePicker({ onSelect }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3">
      {TYPES.map(({ type, label, icon: Icon, description }) => (
        <button
          key={type}
          onClick={() => onSelect(type)}
          className="flex flex-col items-start gap-2 p-4 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-accent/40 transition-colors text-left"
        >
          <Icon className="w-5 h-5 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
