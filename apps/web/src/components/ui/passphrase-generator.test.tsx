import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PassphraseGenerator } from './passphrase-generator';

describe('PassphraseGenerator', () => {
  it('shows the generator prompt before any phrase is rolled', () => {
    render(<PassphraseGenerator onAccept={() => {}} />);
    expect(screen.getByRole('button', { name: /generate passphrase/i })).toBeInTheDocument();
    expect(screen.queryByTestId('passphrase-value')).toBeNull();
  });

  it('produces a hyphenated 7-word passphrase by default', async () => {
    const user = userEvent.setup();
    render(<PassphraseGenerator onAccept={() => {}} />);
    await user.click(screen.getByRole('button', { name: /generate passphrase/i }));
    const value = screen.getByTestId('passphrase-value').textContent ?? '';
    expect(value.split('-')).toHaveLength(7);
  });

  it('rerolls the passphrase on subsequent clicks', async () => {
    const user = userEvent.setup();
    render(<PassphraseGenerator onAccept={() => {}} />);
    await user.click(screen.getByRole('button', { name: /generate passphrase/i }));
    const first = screen.getByTestId('passphrase-value').textContent;
    await user.click(screen.getByRole('button', { name: /reroll/i }));
    const second = screen.getByTestId('passphrase-value').textContent;
    expect(second).not.toBe(first);
  });

  it('regenerates with the new word count when toggled', async () => {
    const user = userEvent.setup();
    render(<PassphraseGenerator onAccept={() => {}} />);
    await user.click(screen.getByRole('button', { name: /generate passphrase/i }));
    await user.click(screen.getByRole('radio', { name: '8w' }));
    const value = screen.getByTestId('passphrase-value').textContent ?? '';
    expect(value.split('-')).toHaveLength(8);
  });

  it('changing word count before generating does not produce a phrase', async () => {
    const user = userEvent.setup();
    render(<PassphraseGenerator onAccept={() => {}} />);
    await user.click(screen.getByRole('radio', { name: '6w' }));
    expect(screen.queryByTestId('passphrase-value')).toBeNull();
  });

  it('passes the generated passphrase to onAccept', async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();
    render(<PassphraseGenerator onAccept={onAccept} />);
    await user.click(screen.getByRole('button', { name: /generate passphrase/i }));
    const value = screen.getByTestId('passphrase-value').textContent ?? '';
    await user.click(screen.getByRole('button', { name: /use this/i }));
    expect(onAccept).toHaveBeenCalledWith(value);
  });
});
