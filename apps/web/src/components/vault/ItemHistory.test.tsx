import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ItemHistory } from './ItemHistory';

vi.mock('@/hooks/useVault', () => ({
  useItemVersions: vi.fn(),
  useItemVersion: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}));

import { useItemVersions, useItemVersion } from '@/hooks/useVault';
import { toast } from 'sonner';

const mockVersions = [
  { id: 'v1', versionNum: 1, createdAt: '2024-01-01T00:00:00Z' },
  { id: 'v2', versionNum: 2, createdAt: '2024-02-01T00:00:00Z' },
];

const mockLoginVersion = {
  type: 'login' as const,
  title: 'GitHub',
  username: 'user@example.com',
  password: 'secret123',
  url: 'https://github.com',
  notes: undefined,
  versionNum: 1,
  createdAt: '2024-01-01T00:00:00Z',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function idle(): any {
  return { data: undefined, isLoading: false, isError: false };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useItemVersions).mockReturnValue(idle());
  vi.mocked(useItemVersion).mockReturnValue(idle());
});

describe('ItemHistory', () => {
  it('renders History toggle button', () => {
    render(<ItemHistory itemId="item-1" />);
    expect(screen.getByRole('button', { name: /History/i })).toBeInTheDocument();
  });

  it('does not fetch versions until opened', () => {
    render(<ItemHistory itemId="item-1" />);
    expect(useItemVersions).toHaveBeenCalledWith('');
  });

  it('fetches versions when opened', async () => {
    const user = userEvent.setup();
    render(<ItemHistory itemId="item-1" />);
    await user.click(screen.getByRole('button', { name: /History/i }));
    expect(useItemVersions).toHaveBeenCalledWith('item-1');
  });

  it('shows loading skeletons while versions load', async () => {
    const user = userEvent.setup();
    vi.mocked(useItemVersions).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as unknown as ReturnType<typeof useItemVersions>);

    render(<ItemHistory itemId="item-1" />);
    await user.click(screen.getByRole('button', { name: /History/i }));
    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it('shows empty state when no versions', async () => {
    const user = userEvent.setup();
    vi.mocked(useItemVersions).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useItemVersions>);

    render(<ItemHistory itemId="item-1" />);
    await user.click(screen.getByRole('button', { name: /History/i }));
    expect(screen.getByText('No history yet.')).toBeInTheDocument();
  });

  it('renders version rows', async () => {
    const user = userEvent.setup();
    vi.mocked(useItemVersions).mockReturnValue({
      data: mockVersions,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useItemVersions>);

    render(<ItemHistory itemId="item-1" />);
    await user.click(screen.getByRole('button', { name: /History/i }));
    expect(screen.getByText(/Version 1/)).toBeInTheDocument();
    expect(screen.getByText(/Version 2/)).toBeInTheDocument();
  });

  it('expands a version row and shows decrypted login fields', async () => {
    const user = userEvent.setup();
    vi.mocked(useItemVersions).mockReturnValue({
      data: mockVersions,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useItemVersions>);
    vi.mocked(useItemVersion).mockReturnValue({
      data: mockLoginVersion,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useItemVersion>);

    render(<ItemHistory itemId="item-1" />);
    await user.click(screen.getByRole('button', { name: /History/i }));
    await user.click(screen.getByText(/Version 1/));

    expect(screen.getByText('user@example.com')).toBeInTheDocument();
    expect(screen.getByText('https://github.com')).toBeInTheDocument();
  });

  it('masks password by default and reveals on Show', async () => {
    const user = userEvent.setup();
    vi.mocked(useItemVersions).mockReturnValue({
      data: [mockVersions[0]],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useItemVersions>);
    vi.mocked(useItemVersion).mockReturnValue({
      data: mockLoginVersion,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useItemVersion>);

    render(<ItemHistory itemId="item-1" />);
    await user.click(screen.getByRole('button', { name: /History/i }));
    await user.click(screen.getByText(/Version 1/));

    expect(screen.queryByText('secret123')).not.toBeInTheDocument();
    expect(screen.getByText('••••••••••••')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show' }));
    expect(screen.getByText('secret123')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hide' }));
    expect(screen.queryByText('secret123')).not.toBeInTheDocument();
  });

  it('shows error toast when version fetch fails', async () => {
    const user = userEvent.setup();
    vi.mocked(useItemVersions).mockReturnValue({
      data: [mockVersions[0]],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useItemVersions>);
    vi.mocked(useItemVersion).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as unknown as ReturnType<typeof useItemVersion>);

    render(<ItemHistory itemId="item-1" />);
    await user.click(screen.getByRole('button', { name: /History/i }));
    await user.click(screen.getByText(/Version 1/));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/couldn't load/i));
    });
  });

  it('shows fallback text when version data is null after load', async () => {
    const user = userEvent.setup();
    vi.mocked(useItemVersions).mockReturnValue({
      data: [mockVersions[0]],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useItemVersions>);
    vi.mocked(useItemVersion).mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useItemVersion>);

    render(<ItemHistory itemId="item-1" />);
    await user.click(screen.getByRole('button', { name: /History/i }));
    await user.click(screen.getByText(/Version 1/));

    expect(screen.getByText('Failed to decrypt version.')).toBeInTheDocument();
  });

  it('shows decrypted secure_note fields', async () => {
    const user = userEvent.setup();
    vi.mocked(useItemVersions).mockReturnValue({
      data: [mockVersions[0]],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useItemVersions>);
    vi.mocked(useItemVersion).mockReturnValue({
      data: {
        type: 'secure_note',
        title: 'Note',
        content: 'My secret note',
        versionNum: 1,
        createdAt: '',
      },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useItemVersion>);

    render(<ItemHistory itemId="item-1" />);
    await user.click(screen.getByRole('button', { name: /History/i }));
    await user.click(screen.getByText(/Version 1/));
    expect(screen.getByText('My secret note')).toBeInTheDocument();
  });

  it('shows decrypted payment_card fields', async () => {
    const user = userEvent.setup();
    vi.mocked(useItemVersions).mockReturnValue({
      data: [mockVersions[0]],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useItemVersions>);
    vi.mocked(useItemVersion).mockReturnValue({
      data: {
        type: 'payment_card',
        title: 'Visa',
        cardholderName: 'Jane Doe',
        number: '4111111111111111',
        expMonth: '12',
        expYear: '2028',
        cvv: '123',
        versionNum: 1,
        createdAt: '',
      },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useItemVersion>);

    render(<ItemHistory itemId="item-1" />);
    await user.click(screen.getByRole('button', { name: /History/i }));
    await user.click(screen.getByText(/Version 1/));
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('4111111111111111')).toBeInTheDocument();
  });

  it('shows decrypted developer credential token fields including key id', async () => {
    const user = userEvent.setup();
    vi.mocked(useItemVersions).mockReturnValue({
      data: [mockVersions[0]],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useItemVersions>);
    vi.mocked(useItemVersion).mockReturnValue({
      data: {
        type: 'developer_credential',
        title: 'OpenAI',
        provider: 'OpenAI',
        credentialMode: 'token',
        secret: 'sk-live-123',
        keyId: 'primary',
        environment: 'production',
        baseUrl: 'https://api.openai.com',
        versionNum: 1,
        createdAt: '',
      },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useItemVersion>);

    render(<ItemHistory itemId="item-1" />);
    await user.click(screen.getByRole('button', { name: /History/i }));
    await user.click(screen.getByText(/Version 1/));

    expect(screen.getByText('OpenAI')).toBeInTheDocument();
    expect(screen.getByText('production')).toBeInTheDocument();
    expect(screen.getByText('https://api.openai.com')).toBeInTheDocument();
    expect(screen.getByText('primary')).toBeInTheDocument();
  });

  it('shows decrypted api_key client credential fields', async () => {
    const user = userEvent.setup();
    vi.mocked(useItemVersions).mockReturnValue({
      data: [mockVersions[0]],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useItemVersions>);
    vi.mocked(useItemVersion).mockReturnValue({
      data: {
        type: 'developer_credential',
        title: 'Stripe',
        provider: 'Stripe',
        credentialMode: 'client_secret_pair',
        clientId: 'client_123',
        clientSecret: 'secret_456',
        environment: 'staging',
        baseUrl: 'https://stripe.example.test',
        versionNum: 1,
        createdAt: '',
      },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useItemVersion>);

    render(<ItemHistory itemId="item-1" />);
    await user.click(screen.getByRole('button', { name: /History/i }));
    await user.click(screen.getByText(/Version 1/));

    expect(screen.getByText('Stripe')).toBeInTheDocument();
    expect(screen.getByText('staging')).toBeInTheDocument();
    expect(screen.getByText('https://stripe.example.test')).toBeInTheDocument();
    expect(screen.getByText('client_123')).toBeInTheDocument();
    expect(screen.queryByText('secret_456')).not.toBeInTheDocument();
    expect(screen.getByText('••••••••••••')).toBeInTheDocument();
  });

  it('shows decrypted ssh developer credential fields with masked secrets', async () => {
    const user = userEvent.setup();
    vi.mocked(useItemVersions).mockReturnValue({
      data: [mockVersions[0]],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useItemVersions>);
    vi.mocked(useItemVersion).mockReturnValue({
      data: {
        type: 'developer_credential',
        title: 'Prod SSH',
        credentialMode: 'ssh_key',
        username: 'deploy',
        host: 'bastion.example.com',
        algorithm: 'ed25519',
        fingerprint: 'SHA256:abc123',
        publicKey: 'ssh-ed25519 AAAAC3Nza...',
        privateKey: '-----BEGIN OPENSSH PRIVATE KEY-----',
        passphrase: 'hunter2',
        versionNum: 1,
        createdAt: '',
      },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useItemVersion>);

    render(<ItemHistory itemId="item-1" />);
    await user.click(screen.getByRole('button', { name: /History/i }));
    await user.click(screen.getByText(/Version 1/));

    expect(screen.getByText('deploy')).toBeInTheDocument();
    expect(screen.getByText('bastion.example.com')).toBeInTheDocument();
    expect(screen.getByText('ed25519')).toBeInTheDocument();
    expect(screen.getByText('SHA256:abc123')).toBeInTheDocument();
    expect(screen.getByText('ssh-ed25519 AAAAC3Nza...')).toBeInTheDocument();
    expect(screen.queryByText('hunter2')).not.toBeInTheDocument();
  });

  it('shows decrypted identity fields', async () => {
    const user = userEvent.setup();
    vi.mocked(useItemVersions).mockReturnValue({
      data: [mockVersions[0]],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useItemVersions>);
    vi.mocked(useItemVersion).mockReturnValue({
      data: {
        type: 'identity',
        title: 'ID',
        firstName: 'Jane',
        lastName: 'Doe',
        versionNum: 1,
        createdAt: '',
      },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useItemVersion>);

    render(<ItemHistory itemId="item-1" />);
    await user.click(screen.getByRole('button', { name: /History/i }));
    await user.click(screen.getByText(/Version 1/));
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
  });

  it('shows decrypted totp fields with masked secret', async () => {
    const user = userEvent.setup();
    vi.mocked(useItemVersions).mockReturnValue({
      data: [mockVersions[0]],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useItemVersions>);
    vi.mocked(useItemVersion).mockReturnValue({
      data: {
        type: 'totp',
        title: 'GitHub 2FA',
        secret: 'JBSWY3DPEHPK3PXP',
        issuer: 'GitHub',
        accountName: 'user@example.com',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        versionNum: 1,
        createdAt: '',
      },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useItemVersion>);

    render(<ItemHistory itemId="item-1" />);
    await user.click(screen.getByRole('button', { name: /History/i }));
    await user.click(screen.getByText(/Version 1/));
    expect(screen.queryByText('JBSWY3DPEHPK3PXP')).not.toBeInTheDocument();
    expect(screen.getByText('GitHub')).toBeInTheDocument();
  });

  it('shows custom fields', async () => {
    const user = userEvent.setup();
    vi.mocked(useItemVersions).mockReturnValue({
      data: [mockVersions[0]],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useItemVersions>);
    vi.mocked(useItemVersion).mockReturnValue({
      data: { ...mockLoginVersion, customFields: [{ label: 'Recovery', value: 'abc-123' }] },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useItemVersion>);

    render(<ItemHistory itemId="item-1" />);
    await user.click(screen.getByRole('button', { name: /History/i }));
    await user.click(screen.getByText(/Version 1/));
    expect(screen.getByText('abc-123')).toBeInTheDocument();
  });

  it('shows loading skeleton when version is loading after expansion', async () => {
    const user = userEvent.setup();
    vi.mocked(useItemVersions).mockReturnValue({
      data: [mockVersions[0]],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useItemVersions>);
    vi.mocked(useItemVersion).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as unknown as ReturnType<typeof useItemVersion>);

    render(<ItemHistory itemId="item-1" />);
    await user.click(screen.getByRole('button', { name: /History/i }));
    await user.click(screen.getByText(/Version 1/));

    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it('shows login notes when present', async () => {
    const user = userEvent.setup();
    vi.mocked(useItemVersions).mockReturnValue({
      data: [mockVersions[0]],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useItemVersions>);
    vi.mocked(useItemVersion).mockReturnValue({
      data: { ...mockLoginVersion, notes: 'my secret note' },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useItemVersion>);

    render(<ItemHistory itemId="item-1" />);
    await user.click(screen.getByRole('button', { name: /History/i }));
    await user.click(screen.getByText(/Version 1/));
    expect(screen.getByText('my secret note')).toBeInTheDocument();
  });

  it('shows payment_card notes when present', async () => {
    const user = userEvent.setup();
    vi.mocked(useItemVersions).mockReturnValue({
      data: [mockVersions[0]],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useItemVersions>);
    vi.mocked(useItemVersion).mockReturnValue({
      data: {
        type: 'payment_card' as const,
        title: 'Visa',
        cardholderName: 'Jane',
        number: '4111111111111111',
        expMonth: '12',
        expYear: '2028',
        notes: 'business card',
        versionNum: 1,
        createdAt: '',
      },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useItemVersion>);

    render(<ItemHistory itemId="item-1" />);
    await user.click(screen.getByRole('button', { name: /History/i }));
    await user.click(screen.getByText(/Version 1/));
    expect(screen.getByText('business card')).toBeInTheDocument();
  });

  it('shows identity optional fields when present', async () => {
    const user = userEvent.setup();
    vi.mocked(useItemVersions).mockReturnValue({
      data: [mockVersions[0]],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useItemVersions>);
    vi.mocked(useItemVersion).mockReturnValue({
      data: {
        type: 'identity' as const,
        title: 'ID',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        phone: '+1234567890',
        notes: 'personal id',
        versionNum: 1,
        createdAt: '',
      },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useItemVersion>);

    render(<ItemHistory itemId="item-1" />);
    await user.click(screen.getByRole('button', { name: /History/i }));
    await user.click(screen.getByText(/Version 1/));
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getByText('+1234567890')).toBeInTheDocument();
    expect(screen.getByText('personal id')).toBeInTheDocument();
  });

  it('shows totp notes when present', async () => {
    const user = userEvent.setup();
    vi.mocked(useItemVersions).mockReturnValue({
      data: [mockVersions[0]],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useItemVersions>);
    vi.mocked(useItemVersion).mockReturnValue({
      data: {
        type: 'totp' as const,
        title: '2FA',
        secret: 'JBSWY3DPEHPK3PXP',
        notes: 'recovery note',
        versionNum: 1,
        createdAt: '',
      },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useItemVersion>);

    render(<ItemHistory itemId="item-1" />);
    await user.click(screen.getByRole('button', { name: /History/i }));
    await user.click(screen.getByText(/Version 1/));
    expect(screen.getByText('recovery note')).toBeInTheDocument();
  });

  it('shows developer credential token fields with masked secret', async () => {
    const user = userEvent.setup();
    vi.mocked(useItemVersions).mockReturnValue({
      data: [mockVersions[0]],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useItemVersions>);
    vi.mocked(useItemVersion).mockReturnValue({
      data: {
        type: 'developer_credential' as const,
        title: 'OpenAI prod key',
        provider: 'OpenAI',
        credentialMode: 'token' as const,
        secret: 'sk-secret',
        keyId: 'primary',
        environment: 'production',
        baseUrl: 'https://api.openai.com/v1',
        notes: 'server workload',
        versionNum: 1,
        createdAt: '',
      },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useItemVersion>);

    render(<ItemHistory itemId="item-1" />);
    await user.click(screen.getByRole('button', { name: /History/i }));
    await user.click(screen.getByText(/Version 1/));

    expect(screen.getByText('OpenAI')).toBeInTheDocument();
    expect(screen.getByText('production')).toBeInTheDocument();
    expect(screen.queryByText('sk-secret')).not.toBeInTheDocument();
    expect(screen.getByText('primary')).toBeInTheDocument();
    expect(screen.getByText('server workload')).toBeInTheDocument();
  });

  it('shows decrypted crypto_wallet fields', async () => {
    const user = userEvent.setup();
    vi.mocked(useItemVersions).mockReturnValue({
      data: [mockVersions[0]],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useItemVersions>);
    vi.mocked(useItemVersion).mockReturnValue({
      data: {
        type: 'crypto_wallet' as const,
        title: 'My Wallet',
        mnemonic:
          'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
        passphrase: 'hunter2',
        walletName: 'MetaMask',
        network: 'Ethereum',
        derivationPath: "m/44'/60'/0'/0/0",
        addressHint: '0xABCD',
        notes: 'cold wallet',
        versionNum: 1,
        createdAt: '',
      },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useItemVersion>);

    render(<ItemHistory itemId="item-1" />);
    await user.click(screen.getByRole('button', { name: /History/i }));
    await user.click(screen.getByText(/Version 1/));

    expect(screen.getByText('MetaMask')).toBeInTheDocument();
    expect(screen.getByText('Ethereum')).toBeInTheDocument();
    expect(screen.getByText("m/44'/60'/0'/0/0")).toBeInTheDocument();
    expect(screen.getByText('0xABCD')).toBeInTheDocument();
    expect(screen.getByText('cold wallet')).toBeInTheDocument();
  });

  it('shows crypto_wallet fields when optional fields are absent', async () => {
    const user = userEvent.setup();
    vi.mocked(useItemVersions).mockReturnValue({
      data: [mockVersions[0]],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useItemVersions>);
    vi.mocked(useItemVersion).mockReturnValue({
      data: {
        type: 'crypto_wallet' as const,
        title: 'Bare Wallet',
        mnemonic:
          'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
        versionNum: 1,
        createdAt: '',
      },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useItemVersion>);

    render(<ItemHistory itemId="item-1" />);
    await user.click(screen.getByRole('button', { name: /History/i }));
    await user.click(screen.getByText(/Version 1/));

    expect(screen.queryByText('MetaMask')).not.toBeInTheDocument();
    expect(screen.queryByText('Ethereum')).not.toBeInTheDocument();
  });

  it('closes history panel when toggled again', async () => {
    const user = userEvent.setup();
    vi.mocked(useItemVersions).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useItemVersions>);

    render(<ItemHistory itemId="item-1" />);
    await user.click(screen.getByRole('button', { name: /History/i }));
    expect(screen.getByText('No history yet.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /History/i }));
    expect(screen.queryByText('No history yet.')).not.toBeInTheDocument();
  });
});
