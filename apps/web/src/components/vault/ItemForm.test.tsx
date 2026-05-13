import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useBlocker } from '@tanstack/react-router';
import { parseOtpauthUri } from '@/lib/totp';
import { ItemForm } from './ItemForm';

vi.mock('@tanstack/react-router', () => ({
  useBlocker: vi.fn(),
}));

vi.mock('@/lib/totp', () => ({
  parseOtpauthUri: vi.fn(),
}));

vi.mock('./PasswordGeneratorDialog', () => ({
  PasswordGeneratorDialog: ({ onUse }: { onUse: (p: string) => void }) => (
    <button data-testid="mock-gen-btn" onClick={() => onUse('generated-pass')}>
      Gen
    </button>
  ),
}));

vi.mock('./MnemonicGrid', () => ({
  MnemonicGrid: ({ onChange }: { onChange: (v: string) => void }) => (
    <div
      data-testid="mock-mnemonic-grid"
      onClick={() =>
        onChange(
          'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
        )
      }
    />
  ),
}));

describe('ItemForm', () => {
  const onSubmit = vi.fn(async () => {});
  const onCancel = vi.fn(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('login type', () => {
    it('renders required fields', () => {
      render(<ItemForm type="login" onSubmit={onSubmit} onCancel={onCancel} />);
      expect(screen.getByLabelText('Title')).toBeInTheDocument();
      expect(screen.getByLabelText('Username')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(screen.getByLabelText(/^URL/)).toBeInTheDocument();
    });
  });

  describe('secure_note type', () => {
    it('renders required fields', () => {
      render(<ItemForm type="secure_note" onSubmit={onSubmit} onCancel={onCancel} />);
      expect(screen.getByLabelText('Title')).toBeInTheDocument();
      expect(screen.getByLabelText('Content')).toBeInTheDocument();
    });
  });

  describe('totp type', () => {
    it('renders and parses otpauth URI', async () => {
      vi.mocked(parseOtpauthUri).mockReturnValue({
        secret: 'JBSWY3DPEHPK3PXP',
        issuer: 'Google',
        accountName: 'user@gmail.com',
        algorithm: 'SHA256',
        digits: 6,
        period: 30,
      });

      render(<ItemForm type="totp" onSubmit={onSubmit} onCancel={onCancel} />);
      fireEvent.change(screen.getByLabelText('Paste URI or Secret'), {
        target: { value: 'otpauth://totp/Google:user@gmail.com?secret=JBSWY3DPEHPK3PXP' },
      });

      await waitFor(() => {
        expect(screen.getByLabelText('Title')).toHaveValue('Google');
        expect(screen.getByLabelText('Secret')).toHaveValue('JBSWY3DPEHPK3PXP');
        expect(screen.getByLabelText(/^Issuer/)).toHaveValue('Google');
        expect(screen.getByLabelText(/^Account Name/)).toHaveValue('user@gmail.com');
      });

      // Show advanced if not already visible to check algorithm
      const user = userEvent.setup();
      if (!screen.queryByLabelText('Algorithm')) {
        await user.click(screen.getByRole('button', { name: /Advanced/ }));
      }
      await waitFor(() => {
        expect(screen.getByLabelText('Algorithm')).toBeInTheDocument();
        expect(screen.getByLabelText('Algorithm').textContent).toContain('SHA256');
      });
    });

    it('shows error message for invalid otpauth URI', async () => {
      vi.mocked(parseOtpauthUri).mockReturnValue(null);

      render(<ItemForm type="totp" onSubmit={onSubmit} onCancel={onCancel} />);
      fireEvent.change(screen.getByLabelText('Paste URI or Secret'), {
        target: { value: 'otpauth://invalid' },
      });

      await waitFor(() =>
        expect(
          screen.getByText("Couldn't parse this URI. Try pasting the Base32 secret directly."),
        ).toBeInTheDocument(),
      );
    });

    it('toggles advanced settings section', async () => {
      const user = userEvent.setup();
      render(<ItemForm type="totp" onSubmit={onSubmit} onCancel={onCancel} />);
      expect(screen.queryByLabelText('Algorithm')).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /Advanced/ }));
      expect(screen.getByLabelText('Algorithm')).toBeInTheDocument();
    });

    it('changes digits via advanced TOTP select', async () => {
      const user = userEvent.setup();
      render(<ItemForm type="totp" onSubmit={onSubmit} onCancel={onCancel} />);
      await user.click(screen.getByRole('button', { name: /Advanced/ }));
      await user.click(screen.getByLabelText('Digits'));
      await user.click(screen.getByRole('option', { name: '8' }));
      expect(screen.getByLabelText('Digits').textContent).toContain('8');
    });
  });

  describe('UI features', () => {
    it('toggles password visibility', async () => {
      const user = userEvent.setup();
      render(<ItemForm type="login" onSubmit={onSubmit} onCancel={onCancel} />);
      const passwordInput = screen.getByLabelText('Password');
      expect(passwordInput).toHaveAttribute('type', 'password');
      await user.click(screen.getByRole('button', { name: 'Show password' }));
      expect(passwordInput).toHaveAttribute('type', 'text');
      await user.click(screen.getByRole('button', { name: 'Hide password' }));
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('updates password strength meter', async () => {
      const user = userEvent.setup();
      render(<ItemForm type="login" onSubmit={onSubmit} onCancel={onCancel} />);
      const passwordInput = screen.getByLabelText('Password');
      await user.type(passwordInput, 'password');
      await waitFor(() => {
        const label = screen.getByTestId('pw-strength-label');
        expect(label.textContent).toMatch(/Very weak|Weak/);
      });
      await user.clear(passwordInput);
      await user.type(passwordInput, 'correct horse battery staple');
      await waitFor(() => {
        const label = screen.getByTestId('pw-strength-label');
        expect(label.textContent).toMatch(/Good|Strong/);
      });
    });

    it('adds and removes custom fields', async () => {
      const user = userEvent.setup();
      render(<ItemForm type="login" onSubmit={onSubmit} onCancel={onCancel} />);
      await user.click(screen.getByRole('button', { name: /Add field/ }));
      expect(screen.getByPlaceholderText('Label')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Remove field' }));
      expect(screen.queryByPlaceholderText('Label')).not.toBeInTheDocument();
    });

    it('calls onCancel when Cancel button is clicked with no unsaved changes', async () => {
      const user = userEvent.setup();
      render(<ItemForm type="login" onSubmit={onSubmit} onCancel={onCancel} />);
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onCancel).toHaveBeenCalled();
    });

    it('shows discard dialog when Cancel is clicked with unsaved changes', async () => {
      const user = userEvent.setup();
      render(<ItemForm type="login" onSubmit={onSubmit} onCancel={onCancel} />);
      await user.type(screen.getByLabelText('Title'), 'Test');
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onCancel).not.toHaveBeenCalled();
      expect(screen.getByText('Discard changes?')).toBeInTheDocument();
    });

    it('calls onCancel after confirming discard dialog', async () => {
      const user = userEvent.setup();
      render(<ItemForm type="login" onSubmit={onSubmit} onCancel={onCancel} />);
      await user.type(screen.getByLabelText('Title'), 'Test');
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      await user.click(screen.getByRole('button', { name: 'Discard' }));
      expect(onCancel).toHaveBeenCalled();
    });

    it('keeps form open when discard dialog is dismissed', async () => {
      const user = userEvent.setup();
      render(<ItemForm type="login" onSubmit={onSubmit} onCancel={onCancel} />);
      await user.type(screen.getByLabelText('Title'), 'Test');
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      await user.click(screen.getByRole('button', { name: 'Keep editing' }));
      expect(onCancel).not.toHaveBeenCalled();
      expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument();
    });
  });

  describe('blocker & generator', () => {
    it('blocks navigation when form is dirty', () => {
      render(<ItemForm type="login" onSubmit={onSubmit} onCancel={onCancel} />);
      const calls = vi.mocked(useBlocker).mock.calls;
      const opts = calls[0][0] as unknown as { shouldBlockFn: () => boolean };
      expect(opts.shouldBlockFn()).toBe(true);
    });

    it('allows navigation after discard is confirmed', async () => {
      const user = userEvent.setup();
      render(<ItemForm type="login" onSubmit={onSubmit} onCancel={onCancel} />);
      await user.type(screen.getByLabelText('Title'), 'Test');
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      await user.click(screen.getByRole('button', { name: 'Discard' }));
      // discardConfirmed ref is true; onCancel is mocked so no navigation triggers,
      // but shouldBlockFn should return false on next call
      const calls = vi.mocked(useBlocker).mock.calls;
      const opts = calls[calls.length - 1][0] as unknown as { shouldBlockFn: () => boolean };
      expect(opts.shouldBlockFn()).toBe(false);
    });

    it('sets password from generator', async () => {
      const user = userEvent.setup();
      render(<ItemForm type="login" onSubmit={onSubmit} onCancel={onCancel} />);
      await user.click(screen.getByTestId('mock-gen-btn'));
      const input = screen.getByLabelText('Password') as HTMLInputElement;
      expect(input.value).toBe('generated-pass');
    });
  });

  describe('extra types & coverage', () => {
    it('renders payment_card fields', () => {
      render(<ItemForm type="payment_card" onSubmit={onSubmit} onCancel={onCancel} />);
      expect(screen.getByLabelText('Cardholder Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Card Number')).toBeInTheDocument();
      expect(screen.getByLabelText('Month')).toBeInTheDocument();
      expect(screen.getByLabelText('Year')).toBeInTheDocument();
    });

    it('renders identity fields', () => {
      render(<ItemForm type="identity" onSubmit={onSubmit} onCancel={onCancel} />);
      expect(screen.getByLabelText('First Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Last Name')).toBeInTheDocument();
      expect(screen.getByLabelText(/^Email/)).toBeInTheDocument();
    });

    it('renders developer credential token fields by default', () => {
      render(<ItemForm type="developer_credential" onSubmit={onSubmit} onCancel={onCancel} />);
      expect(screen.getByLabelText('Provider')).toBeInTheDocument();
      expect(screen.getByLabelText('Mode')).toBeInTheDocument();
      expect(screen.getByLabelText('Secret')).toBeInTheDocument();
      expect(screen.getByLabelText(/^Key ID/)).toBeInTheDocument();
    });

    it('switches developer credential mode and renders pair fields', async () => {
      const user = userEvent.setup();
      render(<ItemForm type="developer_credential" onSubmit={onSubmit} onCancel={onCancel} />);

      await user.click(screen.getByLabelText('Mode'));
      await user.click(screen.getByRole('option', { name: 'Client ID + Secret' }));

      expect(screen.getByLabelText('Client ID')).toBeInTheDocument();
      expect(screen.getByLabelText('Client Secret')).toBeInTheDocument();
      expect(screen.queryByLabelText('Secret')).not.toBeInTheDocument();
    });

    it('switches developer credential mode from pair defaults back to token and clears pair fields', async () => {
      const user = userEvent.setup();
      render(
        <ItemForm
          type="developer_credential"
          onSubmit={onSubmit}
          onCancel={onCancel}
          defaultValues={{
            type: 'developer_credential',
            title: 'OpenAI',
            provider: 'OpenAI',
            credentialMode: 'client_secret_pair',
            clientId: 'client-id',
            clientSecret: 'client-secret',
          }}
        />,
      );

      expect(screen.getByLabelText('Client ID')).toHaveValue('client-id');
      await user.click(screen.getByLabelText('Mode'));
      await user.click(screen.getByRole('option', { name: 'Token' }));
      await user.click(screen.getByRole('button', { name: 'Switch mode' }));

      expect(screen.getByLabelText('Secret')).toBeInTheDocument();
      expect(screen.queryByDisplayValue('client-id')).not.toBeInTheDocument();
      expect(screen.queryByDisplayValue('client-secret')).not.toBeInTheDocument();
    });

    it('shows switch mode dialog before clearing developer credential mode-specific fields', async () => {
      const user = userEvent.setup();

      render(<ItemForm type="developer_credential" onSubmit={onSubmit} onCancel={onCancel} />);
      await user.type(screen.getByLabelText('Secret'), 'sk-secret');
      await user.click(screen.getByLabelText('Mode'));
      await user.click(screen.getByRole('option', { name: 'Client ID + Secret' }));

      expect(screen.getByText('Switch mode?')).toBeInTheDocument();
      expect(screen.getByLabelText('Secret')).toHaveValue('sk-secret');
    });

    it('keeps mode and fields when switch mode dialog is dismissed', async () => {
      const user = userEvent.setup();

      render(<ItemForm type="developer_credential" onSubmit={onSubmit} onCancel={onCancel} />);
      await user.type(screen.getByLabelText('Secret'), 'sk-secret');
      await user.click(screen.getByLabelText('Mode'));
      await user.click(screen.getByRole('option', { name: 'Client ID + Secret' }));
      await user.click(screen.getByRole('button', { name: 'Keep editing' }));

      expect(screen.queryByText('Switch mode?')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Secret')).toHaveValue('sk-secret');
    });

    it('handles form submission error', async () => {
      const user = userEvent.setup();
      const failSubmit = vi.fn().mockRejectedValue(new Error('Failed to save'));
      render(<ItemForm type="login" onSubmit={failSubmit} onCancel={onCancel} />);

      await user.type(screen.getByLabelText('Title'), 'Test');
      await user.type(screen.getByLabelText('Username'), 'user');
      await user.type(screen.getByLabelText('Password'), 'pass');

      await user.click(screen.getByRole('button', { name: 'Save' }));
      expect(await screen.findByText('Failed to save')).toBeInTheDocument();
    });

    it('shows validation errors for developer credential client_secret_pair mode', async () => {
      const user = userEvent.setup();
      render(<ItemForm type="developer_credential" onSubmit={onSubmit} onCancel={onCancel} />);

      await user.click(screen.getByLabelText('Mode'));
      await user.click(screen.getByRole('option', { name: 'Client ID + Secret' }));
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(await screen.findAllByText(/expected string to have >=1 characters/)).toHaveLength(3);
    });

    it('toggles developer credential secret visibility in both api modes', async () => {
      const user = userEvent.setup();
      render(<ItemForm type="developer_credential" onSubmit={onSubmit} onCancel={onCancel} />);

      const secretInput = screen.getByLabelText('Secret');
      expect(secretInput).toHaveAttribute('type', 'password');
      await user.click(screen.getByRole('button', { name: 'Show secret' }));
      expect(secretInput).toHaveAttribute('type', 'text');
      await user.click(screen.getByRole('button', { name: 'Hide secret' }));
      expect(secretInput).toHaveAttribute('type', 'password');

      await user.click(screen.getByLabelText('Mode'));
      await user.click(screen.getByRole('option', { name: 'Client ID + Secret' }));

      const clientSecretInput = screen.getByLabelText('Client Secret');
      expect(clientSecretInput).toHaveAttribute('type', 'password');
      await user.click(screen.getByRole('button', { name: 'Show client secret' }));
      expect(clientSecretInput).toHaveAttribute('type', 'text');
      await user.click(screen.getByRole('button', { name: 'Hide client secret' }));
      expect(clientSecretInput).toHaveAttribute('type', 'password');
    });

    it('renders ssh developer credential fields and validates missing metadata', async () => {
      const user = userEvent.setup();
      render(<ItemForm type="developer_credential" onSubmit={onSubmit} onCancel={onCancel} />);

      await user.click(screen.getByLabelText('Mode'));
      await user.click(screen.getByRole('option', { name: 'SSH keypair' }));

      expect(screen.getByLabelText('Username')).toBeInTheDocument();
      expect(screen.getByLabelText('Host')).toBeInTheDocument();
      expect(screen.getByLabelText('Public Key')).toBeInTheDocument();
      expect(screen.getByLabelText('Private Key')).toBeInTheDocument();
      expect(screen.queryByLabelText('Provider')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(await screen.findByText('Algorithm or fingerprint is required')).toBeInTheDocument();
    });

    it('toggles ssh passphrase visibility', async () => {
      const user = userEvent.setup();
      render(<ItemForm type="developer_credential" onSubmit={onSubmit} onCancel={onCancel} />);

      await user.click(screen.getByLabelText('Mode'));
      await user.click(screen.getByRole('option', { name: 'SSH keypair' }));

      const passphraseInput = screen.getByPlaceholderText('Optional passphrase');
      expect(passphraseInput).toHaveAttribute('type', 'password');
      await user.click(screen.getByRole('button', { name: 'Show passphrase' }));
      expect(passphraseInput).toHaveAttribute('type', 'text');
      await user.click(screen.getByRole('button', { name: 'Hide passphrase' }));
      expect(passphraseInput).toHaveAttribute('type', 'password');
    });

    it('switches ssh mode back to token and clears ssh-specific fields', async () => {
      const user = userEvent.setup();

      render(
        <ItemForm
          type="developer_credential"
          onSubmit={onSubmit}
          onCancel={onCancel}
          defaultValues={{
            type: 'developer_credential',
            title: 'Prod SSH',
            credentialMode: 'ssh_key',
            username: 'deploy',
            host: 'bastion.example.com',
            algorithm: 'ed25519',
            publicKey: 'ssh-ed25519 AAAAC3Nza...',
            privateKey: '-----BEGIN OPENSSH PRIVATE KEY-----',
            passphrase: 'hunter2',
          }}
        />,
      );

      expect(screen.getByLabelText('Username')).toHaveValue('deploy');
      await user.click(screen.getByLabelText('Mode'));
      await user.click(screen.getByRole('option', { name: 'Token' }));
      await user.click(screen.getByRole('button', { name: 'Switch mode' }));

      expect(screen.getByLabelText('Secret')).toBeInTheDocument();
      expect(screen.queryByDisplayValue('deploy')).not.toBeInTheDocument();
      expect(screen.queryByDisplayValue('bastion.example.com')).not.toBeInTheDocument();
    });

    it('keeps ssh mode selected when switch mode dialog is dismissed', async () => {
      const user = userEvent.setup();

      render(
        <ItemForm
          type="developer_credential"
          onSubmit={onSubmit}
          onCancel={onCancel}
          defaultValues={{
            type: 'developer_credential',
            title: 'Prod SSH',
            credentialMode: 'ssh_key',
            username: 'deploy',
            host: 'bastion.example.com',
            algorithm: 'ed25519',
            publicKey: 'ssh-ed25519 AAAAC3Nza...',
            privateKey: '-----BEGIN OPENSSH PRIVATE KEY-----',
          }}
        />,
      );

      await user.click(screen.getByLabelText('Mode'));
      await user.click(screen.getByRole('option', { name: 'Token' }));
      expect(screen.getByText('Switch mode?')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Keep editing' }));

      expect(screen.getByLabelText('Username')).toHaveValue('deploy');
    });

    it('sets totp secret directly when not a URI', async () => {
      render(<ItemForm type="totp" onSubmit={onSubmit} onCancel={onCancel} />);
      fireEvent.change(screen.getByLabelText('Paste URI or Secret'), {
        target: { value: 'MYSECRET' },
      });
      expect(screen.getByLabelText('Secret')).toHaveValue('MYSECRET');
    });

    it('shows error for invalid TOTP URI', async () => {
      render(<ItemForm type="totp" onSubmit={onSubmit} onCancel={onCancel} />);
      fireEvent.change(screen.getByLabelText('Paste URI or Secret'), {
        target: { value: 'otpauth://invalid' },
      });
      expect(
        await screen.findByText("Couldn't parse this URI. Try pasting the Base32 secret directly."),
      ).toBeInTheDocument();
    });

    it('sets title when issuer is present in TOTP URI and title is empty', async () => {
      vi.mocked(parseOtpauthUri).mockReturnValue({
        secret: 'SEC',
        issuer: 'MyService',
        accountName: 'user',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
      });
      render(<ItemForm type="totp" onSubmit={onSubmit} onCancel={onCancel} />);
      fireEvent.change(screen.getByLabelText('Paste URI or Secret'), {
        target: { value: 'otpauth://totp/user?secret=SEC&issuer=MyService' },
      });
      expect(screen.getByLabelText('Title')).toHaveValue('MyService');
    });

    it('does NOT overwrite title if already set when parsing TOTP URI', async () => {
      vi.mocked(parseOtpauthUri).mockReturnValue({
        secret: 'SEC',
        issuer: 'MyService',
        accountName: 'user',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
      });
      const user = userEvent.setup();
      render(<ItemForm type="totp" onSubmit={onSubmit} onCancel={onCancel} />);
      await user.type(screen.getByLabelText('Title'), 'Custom Title');
      fireEvent.change(screen.getByLabelText('Paste URI or Secret'), {
        target: { value: 'otpauth://totp/user?secret=SEC&issuer=MyService' },
      });
      expect(screen.getByLabelText('Title')).toHaveValue('Custom Title');
    });

    it('parses TOTP URI without issuer or account name and shows success state', async () => {
      vi.mocked(parseOtpauthUri).mockReturnValue({
        secret: 'SEC',
        issuer: '',
        accountName: '',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
      });

      render(<ItemForm type="totp" onSubmit={onSubmit} onCancel={onCancel} />);
      fireEvent.change(screen.getByLabelText('Paste URI or Secret'), {
        target: { value: 'otpauth://totp/user?secret=SEC' },
      });

      expect(await screen.findByText('URI parsed — fields filled below.')).toBeInTheDocument();
      expect(screen.getByLabelText('Secret')).toHaveValue('SEC');
      expect(screen.getByLabelText('Title')).toHaveValue('');
      expect(screen.getByLabelText(/^Account Name/)).toHaveValue('');
    });

    it('shows validation errors for TOTP', async () => {
      const user = userEvent.setup();
      render(<ItemForm type="totp" onSubmit={onSubmit} onCancel={onCancel} />);
      await user.click(screen.getByRole('button', { name: 'Save' }));
      // Zod default message for min(1) in this version
      expect(await screen.findAllByText(/expected string to have >=1 characters/)).toHaveLength(2);
    });

    it('handles form submission error (not an Error object)', async () => {
      const user = userEvent.setup();
      const failSubmit = vi.fn().mockRejectedValue('String error');
      render(<ItemForm type="login" onSubmit={failSubmit} onCancel={onCancel} />);

      await user.type(screen.getByLabelText('Title'), 'Test');
      await user.type(screen.getByLabelText('Username'), 'user');
      await user.type(screen.getByLabelText('Password'), 'pass');

      await user.click(screen.getByRole('button', { name: 'Save' }));
      expect(await screen.findByText('Failed to save item')).toBeInTheDocument();
    });
  });

  describe('crypto_wallet type', () => {
    it('renders seed phrase field', () => {
      render(<ItemForm type="crypto_wallet" onSubmit={onSubmit} onCancel={onCancel} />);
      expect(screen.getByText('Seed Phrase')).toBeInTheDocument();
      expect(screen.getByTestId('mock-mnemonic-grid')).toBeInTheDocument();
    });

    it('renders wallet passphrase field', () => {
      render(<ItemForm type="crypto_wallet" onSubmit={onSubmit} onCancel={onCancel} />);
      expect(screen.getByLabelText(/^Passphrase/)).toBeInTheDocument();
    });

    it('toggles wallet passphrase visibility', async () => {
      const user = userEvent.setup();
      render(<ItemForm type="crypto_wallet" onSubmit={onSubmit} onCancel={onCancel} />);
      expect(screen.getByLabelText('Show passphrase')).toBeInTheDocument();
      await user.click(screen.getByLabelText('Show passphrase'));
      expect(screen.getByLabelText('Hide passphrase')).toBeInTheDocument();
    });
  });
});
