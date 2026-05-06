import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { validateChecksum, suggestWord } from '@blindpass/vault/bip39';
import { MnemonicGrid } from './MnemonicGrid';

const mockCopy = vi.fn().mockResolvedValue(undefined);

vi.mock('@blindpass/vault/bip39', () => ({
  parseMnemonic: vi.fn((v: string) => {
    const words = typeof v === 'string' && v.trim() ? v.trim().split(/\s+/) : [];
    return { words, canonical: words.join(' ') };
  }),
  validateWordCount: vi.fn((w: string[]) => [12, 15, 18, 21, 24].includes(w.length)),
  validateChecksum: vi.fn().mockResolvedValue({ valid: true }),
  suggestWord: vi.fn().mockResolvedValue(['abandon', 'ability', 'able']),
}));

vi.mock('@/hooks/useCopyWithAutoClear', () => ({
  useCopyWithAutoClear: vi.fn(() => mockCopy),
}));

vi.mock('@/components/ui/responsive-dialog', () => ({
  ResponsiveDialog: ({
    open,
    footer,
    title,
  }: {
    open: boolean;
    footer: React.ReactNode;
    title: string;
  }) =>
    open ? (
      <div data-testid="copy-dialog">
        <span>{title}</span>
        <div data-testid="dialog-footer">{footer}</div>
      </div>
    ) : null,
}));

const VALID_12 =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

describe('MnemonicGrid', () => {
  const onChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockCopy.mockResolvedValue(undefined);
  });

  it('renders paste textarea', () => {
    render(<MnemonicGrid value="" onChange={onChange} />);
    expect(screen.getByPlaceholderText('Paste mnemonic here…')).toBeInTheDocument();
  });

  it('pasting into textarea calls onChange with canonical mnemonic', () => {
    render(<MnemonicGrid value="" onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText('Paste mnemonic here…'), {
      target: { value: 'word1 word2 word3' },
    });
    expect(onChange).toHaveBeenCalledWith('word1 word2 word3');
  });

  it('shows word count and grid when value has words', () => {
    render(<MnemonicGrid value={VALID_12} onChange={onChange} />);
    expect(screen.getByText('12 words')).toBeInTheDocument();
  });

  it('hides words by default', () => {
    render(<MnemonicGrid value={VALID_12} onChange={onChange} />);
    const hiddenCells = screen.getAllByText('••••••');
    expect(hiddenCells.length).toBe(12);
  });

  it('reveals words when clicking Reveal', () => {
    render(<MnemonicGrid value={VALID_12} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Reveal words'));
    expect(screen.getAllByRole('button', { name: /^abandon/ }).length).toBeGreaterThan(0);
  });

  it('hides words again when clicking Hide after revealing', () => {
    render(<MnemonicGrid value={VALID_12} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Reveal words'));
    fireEvent.click(screen.getByLabelText('Hide words'));
    expect(screen.getAllByText('••••••').length).toBe(12);
  });

  it('shows bad_checksum warning', async () => {
    vi.mocked(validateChecksum).mockResolvedValueOnce({ valid: false, reason: 'bad_checksum' });
    render(<MnemonicGrid value={VALID_12} onChange={onChange} />);
    await waitFor(() => {
      expect(
        screen.getByText('Checksum invalid — typo or non-English wordlist?'),
      ).toBeInTheDocument();
    });
  });

  it('shows unknown_word warning', async () => {
    vi.mocked(validateChecksum).mockResolvedValueOnce({ valid: false, reason: 'unknown_word' });
    render(<MnemonicGrid value={VALID_12} onChange={onChange} />);
    await waitFor(() => {
      expect(
        screen.getByText('One or more words not in the BIP39 English wordlist.'),
      ).toBeInTheDocument();
    });
  });

  it('shows no warning when checksum is valid', async () => {
    render(<MnemonicGrid value={VALID_12} onChange={onChange} />);
    await waitFor(() => {
      expect(screen.queryByText(/checksum/i)).not.toBeInTheDocument();
    });
  });

  it('clicking a word starts editing', () => {
    render(<MnemonicGrid value={VALID_12} onChange={onChange} />);
    const wordBtns = screen.getAllByRole('button').filter((b) => b.textContent === '••••••');
    fireEvent.click(wordBtns[0]);
    expect(screen.getByDisplayValue('abandon')).toBeInTheDocument();
  });

  it('pressing Enter commits the edited word', async () => {
    const user = userEvent.setup();
    render(<MnemonicGrid value={VALID_12} onChange={onChange} />);

    const wordBtns = screen.getAllByRole('button').filter((b) => b.textContent === '••••••');
    fireEvent.click(wordBtns[0]);

    const input = screen.getByDisplayValue('abandon');
    await user.clear(input);
    await user.type(input, 'act');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith(expect.stringContaining('act'));
  });

  it('pressing Escape cancels edit without calling onChange', () => {
    render(<MnemonicGrid value={VALID_12} onChange={onChange} />);
    const wordBtns = screen.getAllByRole('button').filter((b) => b.textContent === '••••••');
    fireEvent.click(wordBtns[0]);

    const input = screen.getByDisplayValue('abandon');
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByDisplayValue('abandon')).not.toBeInTheDocument();
  });

  it('pressing Tab completes with first suggestion', async () => {
    const user = userEvent.setup();
    render(<MnemonicGrid value={VALID_12} onChange={onChange} />);

    const wordBtns = screen.getAllByRole('button').filter((b) => b.textContent === '••••••');
    fireEvent.click(wordBtns[0]);

    const input = screen.getByDisplayValue('abandon');
    await user.clear(input);
    await user.type(input, 'ab');

    await waitFor(() => {
      expect(vi.mocked(suggestWord)).toHaveBeenCalledWith('ab');
    });

    fireEvent.keyDown(input, { key: 'Tab' });
    expect(onChange).toHaveBeenCalledWith(expect.stringContaining('abandon'));
  });

  it('copy word button calls copy with that word', async () => {
    render(<MnemonicGrid value={VALID_12} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Copy word 1'));
    await waitFor(() => {
      expect(mockCopy).toHaveBeenCalledWith('abandon');
    });
  });

  it('Copy all button opens confirmation dialog', () => {
    render(<MnemonicGrid value={VALID_12} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Copy mnemonic'));
    expect(screen.getByTestId('copy-dialog')).toBeInTheDocument();
  });

  it('dialog Copy button calls copy and closes dialog', async () => {
    render(<MnemonicGrid value={VALID_12} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Copy mnemonic'));

    const dialog = screen.getByTestId('dialog-footer');
    fireEvent.click(dialog.querySelector('button')!);

    await waitFor(() => {
      expect(mockCopy).toHaveBeenCalledWith(VALID_12);
      expect(screen.queryByTestId('copy-dialog')).not.toBeInTheDocument();
    });
  });

  it('dialog Cancel button closes dialog without copying', async () => {
    render(<MnemonicGrid value={VALID_12} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Copy mnemonic'));

    const dialog = screen.getByTestId('dialog-footer');
    const buttons = dialog.querySelectorAll('button');
    fireEvent.click(buttons[1]!);

    expect(screen.queryByTestId('copy-dialog')).not.toBeInTheDocument();
    expect(mockCopy).not.toHaveBeenCalled();
  });

  it('blurring the edit input commits the word', async () => {
    render(<MnemonicGrid value={VALID_12} onChange={onChange} />);
    const wordBtns = screen.getAllByRole('button').filter((b) => b.textContent === '••••••');
    fireEvent.click(wordBtns[0]);

    const input = screen.getByDisplayValue('abandon');
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith(expect.stringContaining('abandon'));
  });

  it('disabled prop prevents word editing', () => {
    render(<MnemonicGrid value={VALID_12} onChange={onChange} disabled={true} />);
    const wordBtns = screen.getAllByRole('button').filter((b) => b.textContent === '••••••');
    expect(wordBtns.every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
  });

  it('shows empty grid when value is empty string', () => {
    render(<MnemonicGrid value="" onChange={onChange} />);
    expect(screen.queryByText(/words/)).not.toBeInTheDocument();
  });
});
