import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import type { VaultItem } from '@blindpass/vault';
import { PaymentCardFields } from './PaymentCardFields';

function Wrapper() {
  const methods = useForm<VaultItem>({
    defaultValues: { type: 'payment_card', title: '' } as Partial<VaultItem>,
  });
  return (
    <FormProvider {...methods}>
      <form>
        <PaymentCardFields />
      </form>
    </FormProvider>
  );
}

describe('PaymentCardFields', () => {
  it('renders cardholder, number, expiry, cvv', () => {
    render(<Wrapper />);
    expect(screen.getByLabelText('Cardholder Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Card Number')).toBeInTheDocument();
    expect(screen.getByLabelText('Month')).toBeInTheDocument();
    expect(screen.getByLabelText('Year')).toBeInTheDocument();
    expect(screen.getByLabelText(/CVV/)).toBeInTheDocument();
  });
});
