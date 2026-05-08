import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { VaultItem } from '@blindpass/vault';
import { parseOtpauthUri } from '@/lib/totp';
import { asErrorMap } from './types';

export function TotpFields() {
  const {
    register,
    setValue,
    watch,
    formState: { errors: _errors },
  } = useFormContext<VaultItem>();
  const errors = asErrorMap(_errors);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [uriError, setUriError] = useState<string | null>(null);
  const [uriParsed, setUriParsed] = useState(false);

  return (
    <>
      <div className="field-group" data-invalid={!!uriError}>
        <Label htmlFor="totp-uri">Paste URI or Secret</Label>
        <textarea
          id="totp-uri"
          placeholder="otpauth://totp/… or Base32 secret"
          autoComplete="off"
          className="h-auto min-h-[72px] w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-xs transition-all outline-none placeholder:text-muted-foreground focus-visible:border-ring disabled:pointer-events-none disabled:cursor-not-allowed dark:bg-input/20"
          onChange={(e) => {
            const val = e.target.value.trim();
            setUriError(null);
            setUriParsed(false);
            if (val.startsWith('otpauth://')) {
              const parsed = parseOtpauthUri(val);
              if (parsed) {
                setValue('secret' as never, parsed.secret as never, { shouldValidate: true });
                if (parsed.issuer) {
                  setValue('issuer' as never, parsed.issuer as never);
                  if (!watch('title' as never)) {
                    setValue('title' as never, parsed.issuer as never);
                  }
                }
                if (parsed.accountName)
                  setValue('accountName' as never, parsed.accountName as never);
                setValue('algorithm' as never, parsed.algorithm as never);
                setValue('digits' as never, parsed.digits as never);
                setValue('period' as never, parsed.period as never);
                setShowAdvanced(
                  parsed.algorithm !== 'SHA1' || parsed.digits !== 6 || parsed.period !== 30,
                );
                setUriParsed(true);
              } else {
                setUriError("Couldn't parse this URI. Try pasting the Base32 secret directly.");
              }
            } else {
              setValue('secret' as never, val as never, { shouldValidate: true });
            }
          }}
        />
        {uriError ? (
          <FieldError message={uriError} />
        ) : uriParsed ? (
          <p className="text-xs text-primary">URI parsed — fields filled below.</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Paste an <code>otpauth://</code> URI to auto-fill, or enter the Base32 secret directly.
          </p>
        )}
      </div>
      <div className="field-group" data-invalid={!!errors.secret}>
        <Label htmlFor="secret">Secret</Label>
        <Input
          id="secret"
          placeholder="JBSWY3DPEHPK3PXP"
          autoComplete="off"
          className="font-mono"
          {...register('secret' as never)}
        />
        <FieldError message={errors.secret?.message} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="field-group">
          <Label htmlFor="issuer" optional>
            Issuer
          </Label>
          <Input
            id="issuer"
            placeholder="GitHub"
            autoComplete="off"
            {...register('issuer' as never)}
          />
        </div>
        <div className="field-group">
          <Label htmlFor="accountName" optional>
            Account Name
          </Label>
          <Input
            id="accountName"
            placeholder="user@example.com"
            autoComplete="off"
            {...register('accountName' as never)}
          />
        </div>
      </div>
      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground active:text-foreground transition-colors py-1 touch-manipulation"
      >
        {showAdvanced ? (
          <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5" />
        )}
        Advanced
      </button>
      {showAdvanced && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="field-group">
            <Label htmlFor="algorithm">Algorithm</Label>
            <select
              id="algorithm"
              className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring dark:bg-input/20"
              {...register('algorithm' as never)}
            >
              <option value="SHA1">SHA1</option>
              <option value="SHA256">SHA256</option>
              <option value="SHA512">SHA512</option>
            </select>
          </div>
          <div className="field-group">
            <Label htmlFor="digits">Digits</Label>
            <select
              id="digits"
              className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring dark:bg-input/20"
              {...register('digits' as never, { valueAsNumber: true })}
            >
              <option value={6}>6</option>
              <option value={8}>8</option>
            </select>
          </div>
          <div className="field-group">
            <Label htmlFor="period">Period (s)</Label>
            <Input
              id="period"
              type="number"
              min={15}
              max={300}
              {...register('period' as never, { valueAsNumber: true })}
            />
          </div>
        </div>
      )}
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
