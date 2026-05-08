import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import type { VaultItem } from '@blindpass/vault';
import { CryptoWalletFields } from './CryptoWalletFields';

vi.mock('../MnemonicGrid', () => ({
  MnemonicGrid: ({
    onChange,
    value,
  }: {
    onChange: (v: string) => void;
    value: string;
    disabled: boolean;
  }) => (
    <input
      data-testid="mnemonic-grid"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      readOnly={false}
    />
  ),
}));

function Wrapper() {
  const methods = useForm<VaultItem>({
    defaultValues: { type: 'crypto_wallet', title: '', walletMode: 'bip39' } as Partial<VaultItem>,
  });
  return (
    <FormProvider {...methods}>
      <form>
        <CryptoWalletFields />
      </form>
    </FormProvider>
  );
}

describe('CryptoWalletFields', () => {
  it('renders mnemonic + passphrase + wallet name + network', () => {
    render(<Wrapper />);
    expect(screen.getByText('Seed Phrase')).toBeInTheDocument();
    expect(screen.getByLabelText(/Passphrase/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Wallet Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Network/)).toBeInTheDocument();
  });

  it('MnemonicGrid onChange updates form value', () => {
    render(<Wrapper />);
    const grid = screen.getByTestId('mnemonic-grid');
    fireEvent.change(grid, { target: { value: 'abandon abandon abandon' } });
    expect((grid as HTMLInputElement).value).toBe('abandon abandon abandon');
  });

  it('toggles passphrase reveal', () => {
    render(<Wrapper />);
    const passInput = screen.getByLabelText(/Passphrase/) as HTMLInputElement;
    expect(passInput.type).toBe('password');
    fireEvent.click(screen.getByLabelText(/Show passphrase/));
    expect(passInput.type).toBe('text');
  });
});
