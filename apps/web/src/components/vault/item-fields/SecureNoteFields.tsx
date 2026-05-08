import { useFormContext } from 'react-hook-form';
import { FieldError } from '@/components/ui/field-error';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { VaultItem } from '@blindpass/vault';
import { asErrorMap } from './types';

export function SecureNoteFields() {
  const {
    register,
    formState: { errors: _errors },
  } = useFormContext<VaultItem>();
  const errors = asErrorMap(_errors);

  return (
    <div className="field-group" data-invalid={!!errors.content}>
      <Label htmlFor="content">Content</Label>
      <Textarea
        id="content"
        placeholder="Your secure note…"
        autoComplete="off"
        className="min-h-[160px]"
        {...register('content' as never)}
      />
      <FieldError message={errors.content?.message} />
    </div>
  );
}
