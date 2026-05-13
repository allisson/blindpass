import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { VaultItem } from '@blindpass/vault';
import { MnemonicGrid } from '../MnemonicGrid';
import { asErrorMap } from './types';

export function CryptoWalletFields() {
  const {
    register,
    setValue,
    watch,
    formState: { errors: _errors },
  } = useFormContext<VaultItem>();
  const errors = asErrorMap(_errors);
  const [showPassphrase, setShowPassphrase] = useState(false);

  return (
    <>
      <input type="hidden" {...register('walletMode' as never)} />
      <div className="field-group" data-invalid={!!errors.mnemonic}>
        <Label htmlFor="mnemonic">Seed Phrase</Label>
        <MnemonicGrid
          value={(watch('mnemonic' as never) as unknown as string) ?? ''}
          onChange={(v) => setValue('mnemonic' as never, v as never, { shouldValidate: true })}
          disabled={false}
        />
        <FieldError message={errors.mnemonic?.message} />
      </div>
      <div className="field-group">
        <Label htmlFor="walletPassphrase" optional>
          Passphrase
        </Label>
        <div className="relative">
          <Input
            id="walletPassphrase"
            type={showPassphrase ? 'text' : 'password'}
            autoComplete="off"
            className="pr-9"
            placeholder="Optional 25th-word passphrase"
            {...register('passphrase' as never)}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassphrase((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={showPassphrase ? 'Hide passphrase' : 'Show passphrase'}
          >
            {showPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground flex items-start gap-1">
          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5 text-yellow-500" />
          Lost passphrase = different wallet, lost funds.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3">
        <div className="field-group">
          <Label htmlFor="walletName" optional>
            Wallet Name
          </Label>
          <Input
            id="walletName"
            placeholder="My ETH wallet"
            autoComplete="off"
            {...register('walletName' as never)}
          />
        </div>
        <div className="field-group">
          <Label htmlFor="network" optional>
            Network
          </Label>
          <Input
            id="network"
            placeholder="ethereum"
            autoComplete="off"
            list="network-suggestions"
            {...register('network' as never)}
          />
          <datalist id="network-suggestions">
            <option value="bitcoin" />
            <option value="ethereum" />
            <option value="solana" />
            <option value="cosmos" />
            <option value="polkadot" />
          </datalist>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3">
        <div className="field-group" data-invalid={!!errors.derivationPath}>
          <Label htmlFor="derivationPath" optional>
            Derivation Path
          </Label>
          <Input
            id="derivationPath"
            placeholder="m/44'/60'/0'/0/0"
            autoComplete="off"
            className="font-mono text-xs"
            {...register('derivationPath' as never)}
          />
          <FieldError message={errors.derivationPath?.message} />
        </div>
        <div className="field-group" data-invalid={!!errors.addressHint}>
          <Label htmlFor="addressHint" optional>
            Address Hint
          </Label>
          <Input
            id="addressHint"
            placeholder="0x742d35..."
            autoComplete="off"
            maxLength={20}
            className="font-mono text-xs"
            {...register('addressHint' as never)}
          />
          <p className="text-xs text-muted-foreground">First 8–12 chars of derived address.</p>
          <FieldError message={errors.addressHint?.message} />
        </div>
      </div>
      <div className="field-group">
        <Label htmlFor="notes" optional>
          Notes
        </Label>
        <Textarea
          id="notes"
          placeholder="Optional notes"
          autoComplete="off"
          className="min-h-[80px]"
          {...register('notes' as never)}
        />
      </div>
    </>
  );
}
