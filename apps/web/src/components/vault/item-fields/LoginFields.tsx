import { lazy, Suspense, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Eye, EyeOff } from 'lucide-react';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordStrength } from '@/components/ui/password-strength';
import { Textarea } from '@/components/ui/textarea';
import type { VaultItem } from '@blindpass/vault';
import { asErrorMap } from './types';

const PasswordGeneratorDialog = lazy(() =>
  import('../PasswordGeneratorDialog').then((m) => ({ default: m.PasswordGeneratorDialog })),
);

export function LoginFields() {
  const {
    register,
    setValue,
    watch,
    formState: { errors: _errors },
  } = useFormContext<VaultItem>();
  const errors = asErrorMap(_errors);
  const [showPassword, setShowPassword] = useState(false);
  const passwordValue = (watch('password' as never) as unknown as string) ?? '';

  return (
    <>
      <div className="field-group" data-invalid={!!errors.username}>
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          placeholder="user@example.com"
          autoComplete="off"
          {...register('username' as never)}
        />
        <FieldError message={errors.username?.message} />
      </div>
      <div className="field-group" data-invalid={!!errors.password}>
        <Label htmlFor="password">Password</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="••••••••"
              className="pr-9"
              {...register('password' as never)}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <Suspense fallback={null}>
            <PasswordGeneratorDialog
              onUse={(p) => {
                setValue('password' as never, p as never, { shouldValidate: true });
                setShowPassword(true);
              }}
            />
          </Suspense>
        </div>
        <FieldError message={errors.password?.message} />
        <PasswordStrength password={passwordValue} />
      </div>
      <div className="field-group" data-invalid={!!errors.url}>
        <Label htmlFor="url" optional>
          URL
        </Label>
        <Input
          id="url"
          type="url"
          placeholder="https://example.com"
          autoComplete="off"
          inputMode="url"
          {...register('url' as never)}
        />
        <FieldError message={errors.url?.message} />
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
