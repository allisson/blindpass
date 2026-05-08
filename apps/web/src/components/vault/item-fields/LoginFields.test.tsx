import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import type { VaultItem } from '@blindpass/vault';
import { LoginFields } from './LoginFields';

function Wrapper({ defaults }: { defaults?: Partial<VaultItem> }) {
  const methods = useForm<VaultItem>({
    defaultValues: { type: 'login', title: '', ...defaults } as Partial<VaultItem>,
  });
  return (
    <FormProvider {...methods}>
      <form>
        <LoginFields />
      </form>
    </FormProvider>
  );
}

describe('LoginFields', () => {
  it('renders username, password, url, notes inputs', () => {
    render(<Wrapper />);
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByLabelText(/URL/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Notes/)).toBeInTheDocument();
  });

  it('toggles password reveal', () => {
    render(<Wrapper />);
    const password = screen.getByLabelText('Password') as HTMLInputElement;
    expect(password.type).toBe('password');
    fireEvent.click(screen.getByLabelText('Show password'));
    expect(password.type).toBe('text');
  });
});
