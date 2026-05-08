import { useFormContext } from 'react-hook-form';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { VaultItem } from '@blindpass/vault';
import { asErrorMap } from './types';

export function PaymentCardFields() {
  const {
    register,
    formState: { errors: _errors },
  } = useFormContext<VaultItem>();
  const errors = asErrorMap(_errors);

  return (
    <>
      <div className="field-group" data-invalid={!!errors.cardholderName}>
        <Label htmlFor="cardholderName">Cardholder Name</Label>
        <Input
          id="cardholderName"
          placeholder="Jane Doe"
          autoComplete="off"
          {...register('cardholderName' as never)}
        />
        <FieldError message={errors.cardholderName?.message} />
      </div>
      <div className="field-group" data-invalid={!!errors.number}>
        <Label htmlFor="number">Card Number</Label>
        <Input
          id="number"
          placeholder="1234 5678 9012 3456"
          inputMode="numeric"
          autoComplete="off"
          {...register('number' as never)}
        />
        <FieldError message={errors.number?.message} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="field-group col-span-1" data-invalid={!!errors.expMonth}>
          <Label htmlFor="expMonth">Month</Label>
          <Input
            id="expMonth"
            placeholder="MM"
            inputMode="numeric"
            maxLength={2}
            {...register('expMonth' as never)}
          />
          <FieldError message={errors.expMonth?.message} />
        </div>
        <div className="field-group col-span-1" data-invalid={!!errors.expYear}>
          <Label htmlFor="expYear">Year</Label>
          <Input
            id="expYear"
            placeholder="YYYY"
            inputMode="numeric"
            maxLength={4}
            {...register('expYear' as never)}
          />
          <FieldError message={errors.expYear?.message} />
        </div>
        <div className="field-group col-span-1">
          <Label htmlFor="cvv" optional>
            CVV
          </Label>
          <Input
            id="cvv"
            placeholder="123"
            inputMode="numeric"
            maxLength={4}
            {...register('cvv' as never)}
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
