import { useFormContext } from 'react-hook-form';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { VaultItem } from '@blindpass/vault';
import { asErrorMap } from './types';

export function IdentityFields() {
  const {
    register,
    formState: { errors: _errors },
  } = useFormContext<VaultItem>();
  const errors = asErrorMap(_errors);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="field-group" data-invalid={!!errors.firstName}>
          <Label htmlFor="firstName">First Name</Label>
          <Input id="firstName" placeholder="Jane" {...register('firstName' as never)} />
          <FieldError message={errors.firstName?.message} />
        </div>
        <div className="field-group" data-invalid={!!errors.lastName}>
          <Label htmlFor="lastName">Last Name</Label>
          <Input id="lastName" placeholder="Doe" {...register('lastName' as never)} />
          <FieldError message={errors.lastName?.message} />
        </div>
      </div>
      <div className="field-group">
        <Label htmlFor="email" optional>
          Email
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="jane@example.com"
          {...register('email' as never)}
        />
      </div>
      <div className="field-group">
        <Label htmlFor="phone" optional>
          Phone
        </Label>
        <Input
          id="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+1 555 000 0000"
          {...register('phone' as never)}
        />
      </div>
      <div className="field-group">
        <Label htmlFor="address" optional>
          Address
        </Label>
        <Input id="address" placeholder="123 Main St" {...register('address' as never)} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="field-group">
          <Label htmlFor="city" optional>
            City
          </Label>
          <Input
            id="city"
            autoComplete="address-level2"
            placeholder="New York"
            {...register('city' as never)}
          />
        </div>
        <div className="field-group">
          <Label htmlFor="country" optional>
            Country
          </Label>
          <Input
            id="country"
            autoComplete="country"
            placeholder="US"
            {...register('country' as never)}
          />
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
