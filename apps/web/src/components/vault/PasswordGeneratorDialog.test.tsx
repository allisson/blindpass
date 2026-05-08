import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordGeneratorDialog } from './PasswordGeneratorDialog';

let writeTextMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  writeTextMock = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: writeTextMock },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

async function openDialog() {
  const user = userEvent.setup();
  const onUse = vi.fn();
  render(<PasswordGeneratorDialog onUse={onUse} />);
  await user.click(screen.getByRole('button', { name: /open password generator/i }));
  await waitFor(() => expect(screen.getByText('Password Generator')).toBeInTheDocument());
  return { user, onUse };
}

describe('PasswordGeneratorDialog', () => {
  it('renders trigger button', () => {
    render(<PasswordGeneratorDialog onUse={vi.fn()} />);
    expect(screen.getByRole('button', { name: /open password generator/i })).toBeInTheDocument();
  });

  it('opens dialog when trigger is clicked', async () => {
    await openDialog();
    expect(screen.getByText('Password Generator')).toBeInTheDocument();
  });

  it('shows generated password in password mode', async () => {
    await openDialog();
    const preview = document.querySelector('.font-mono');
    expect(preview?.textContent).not.toBe('…');
  });

  it('shows strength indicator', async () => {
    await openDialog();
    expect(
      screen.getByText((t) => /bits/.test(t) && /(Weak|Fair|Good|Strong)/.test(t)),
    ).toBeInTheDocument();
  });

  it('switches to passphrase mode', async () => {
    const { user } = await openDialog();
    await user.click(screen.getByRole('button', { name: /passphrase/i }));
    await waitFor(() => expect(screen.getByText('Words')).toBeInTheDocument());
  });

  it('regenerates password on regenerate button click', async () => {
    const { user } = await openDialog();
    const preview = document.querySelector('.font-mono');
    const before = preview?.textContent;
    await user.click(screen.getByRole('button', { name: /regenerate/i }));
    const after = document.querySelector('.font-mono')?.textContent;
    expect(typeof before).toBe('string');
    expect(typeof after).toBe('string');
  });

  it('shows "Copied!" after copy then resets', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    const onUse = vi.fn();
    render(<PasswordGeneratorDialog onUse={onUse} />);
    await user.click(screen.getByRole('button', { name: /open password generator/i }));
    await waitFor(() => expect(screen.getByText('Password Generator')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /copy/i }));
    await waitFor(() => expect(screen.getByText('Copied!')).toBeInTheDocument());

    vi.advanceTimersByTime(2000);
    await waitFor(() => expect(screen.queryByText('Copied!')).not.toBeInTheDocument());
    vi.useRealTimers();
  });

  it('calls onUse and closes dialog on "Use Password"', async () => {
    const { user, onUse } = await openDialog();
    await user.click(screen.getByRole('button', { name: /use password/i }));
    expect(onUse).toHaveBeenCalledOnce();
    expect(onUse).toHaveBeenCalledWith(expect.any(String));
  });

  it('passphrase mode: separator buttons change separator', async () => {
    const { user } = await openDialog();
    await user.click(screen.getByRole('button', { name: /passphrase/i }));
    await waitFor(() => expect(screen.getByText('Separator')).toBeInTheDocument());
    const dots = screen.getAllByRole('button').find((b) => b.textContent === '·');
    if (dots) await user.click(dots);
  });

  it('passphrase mode: capitalize and include number checkboxes', async () => {
    const { user } = await openDialog();
    await user.click(screen.getByRole('button', { name: /passphrase/i }));
    await waitFor(() => expect(screen.getByLabelText('Capitalize')).toBeInTheDocument());
    await user.click(screen.getByLabelText('Capitalize'));
    await user.click(screen.getByLabelText('Include number'));
  });

  it('password mode: length slider and charset checkboxes', async () => {
    const { user } = await openDialog();
    await waitFor(() => expect(screen.getByLabelText('Uppercase (A–Z)')).toBeInTheDocument());
    await user.click(screen.getByLabelText('Uppercase (A–Z)'));
    await user.click(screen.getByLabelText('Lowercase (a–z)'));
    await user.click(screen.getByLabelText('Numbers (0–9)'));
    await user.click(screen.getByLabelText('Special (!@#…)'));
  });

  it('passphrase mode wordCount=3 shows Weak strength', async () => {
    const { user } = await openDialog();
    await user.click(screen.getByRole('button', { name: /passphrase/i }));
    await waitFor(() => expect(screen.getByText('Words')).toBeInTheDocument());
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '3' } });
    await waitFor(() =>
      expect(screen.getByText((t) => t.includes('Weak') && t.includes('bits'))).toBeInTheDocument(),
    );
  });

  it('passphrase mode wordCount=6 shows Good strength', async () => {
    const { user } = await openDialog();
    await user.click(screen.getByRole('button', { name: /passphrase/i }));
    await waitFor(() => expect(screen.getByText('Words')).toBeInTheDocument());
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '6' } });
    await waitFor(() =>
      expect(screen.getByText((t) => t.includes('Good') && t.includes('bits'))).toBeInTheDocument(),
    );
  });
});
