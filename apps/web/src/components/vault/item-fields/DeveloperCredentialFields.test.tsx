import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('switches to client_secret_pair mode (no data prompt)', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    await user.click(screen.getByLabelText('Mode'));
    await user.click(screen.getByRole('option', { name: 'Client ID + Secret' }));
    expect(screen.getByLabelText('Client ID')).toBeInTheDocument();
    expect(screen.getByLabelText('Client Secret')).toBeInTheDocument();
  });

  it('switches to ssh_key mode and hides provider field', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    await user.click(screen.getByLabelText('Mode'));
    await user.click(screen.getByRole('option', { name: 'SSH keypair' }));
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Public Key')).toBeInTheDocument();
    expect(screen.queryByLabelText('Provider')).not.toBeInTheDocument();
  });

  it('closes mode switch dialog via Escape', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    await user.type(screen.getByLabelText('Secret'), 'sk-secret');
    await user.click(screen.getByLabelText('Mode'));
    await user.click(screen.getByRole('option', { name: 'Client ID + Secret' }));
    expect(screen.getByText('Switch mode?')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByText('Switch mode?')).not.toBeInTheDocument();
  });

  it('toggles token secret reveal', () => {
    render(<Wrapper />);
    const secret = screen.getByLabelText('Secret') as HTMLInputElement;
    expect(secret.type).toBe('password');
    fireEvent.click(screen.getByLabelText('Show secret'));
    expect(secret.type).toBe('text');
  });
});
