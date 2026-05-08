import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import type { VaultItem } from '@blindpass/vault';
import { DeveloperCredentialFields } from './DeveloperCredentialFields';

function Wrapper({ defaults }: { defaults?: Partial<VaultItem> }) {
  const methods = useForm<VaultItem>({
    defaultValues: {
      type: 'developer_credential',
      title: '',
      credentialMode: 'token',
      ...defaults,
    } as Partial<VaultItem>,
  });
  return (
    <FormProvider {...methods}>
      <form>
        <DeveloperCredentialFields initialMode="token" />
      </form>
    </FormProvider>
  );
}

describe('DeveloperCredentialFields', () => {
  it('shows token-mode fields by default', () => {
    render(<Wrapper />);
    expect(screen.getByLabelText('Mode')).toBeInTheDocument();
    expect(screen.getByLabelText('Provider')).toBeInTheDocument();
    expect(screen.getByLabelText('Secret')).toBeInTheDocument();
  });

  it('switches to client_secret_pair mode (no data prompt)', () => {
    render(<Wrapper />);
    fireEvent.change(screen.getByLabelText('Mode'), {
      target: { value: 'client_secret_pair' },
    });
    expect(screen.getByLabelText('Client ID')).toBeInTheDocument();
    expect(screen.getByLabelText('Client Secret')).toBeInTheDocument();
  });

  it('switches to ssh_key mode and hides provider field', () => {
    render(<Wrapper />);
    fireEvent.change(screen.getByLabelText('Mode'), { target: { value: 'ssh_key' } });
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Public Key')).toBeInTheDocument();
    expect(screen.queryByLabelText('Provider')).not.toBeInTheDocument();
  });

  it('toggles token secret reveal', () => {
    render(<Wrapper />);
    const secret = screen.getByLabelText('Secret') as HTMLInputElement;
    expect(secret.type).toBe('password');
    fireEvent.click(screen.getByLabelText('Show secret'));
    expect(secret.type).toBe('text');
  });
});
