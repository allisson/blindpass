import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import type { VaultItem } from '@blindpass/vault';
import { IdentityFields } from './IdentityFields';

function Wrapper() {
  const methods = useForm<VaultItem>({
    defaultValues: { type: 'identity', title: '' } as Partial<VaultItem>,
  });
  return (
    <FormProvider {...methods}>
      <form>
        <IdentityFields />
      </form>
    </FormProvider>
  );
}

describe('IdentityFields', () => {
  it('renders identity fields', () => {
    render(<Wrapper />);
    expect(screen.getByLabelText('First Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Last Name')).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Phone/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Address/)).toBeInTheDocument();
  });
});
