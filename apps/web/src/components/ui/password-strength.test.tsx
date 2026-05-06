import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { PasswordStrength } from './password-strength';
import { resetZxcvbnForTests } from '@/lib/zxcvbn';

beforeEach(() => {
  resetZxcvbnForTests();
});

describe('PasswordStrength', () => {
  it('renders nothing for empty password', () => {
    const { container } = render(<PasswordStrength password="" />);
    expect(container.firstChild).toBeNull();
  });

  it('shows score, label and crack-time once the estimator loads', async () => {
    render(<PasswordStrength password="correct horse battery staple" />);
    await waitFor(() => {
      const label = screen.getByTestId('pw-strength-label');
      expect(label.textContent).toMatch(/Strong|Good/);
    });
    const bar = document.querySelector('.pw-strength');
    expect(bar?.getAttribute('data-score')).toMatch(/[34]/);
  });

  it('surfaces warning or suggestion text for weak passwords', async () => {
    render(<PasswordStrength password="password" />);
    await waitFor(() => {
      expect(screen.getByTestId('pw-strength-message')).toBeInTheDocument();
    });
  });

  it('hides the score label when showLabel is false', async () => {
    render(<PasswordStrength password="correct horse battery staple" showLabel={false} />);
    await waitFor(() => {
      expect(document.querySelector('.pw-strength')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('pw-strength-label')).toBeNull();
  });

  it('calls onScoreChange when the score is computed', async () => {
    const onScoreChange = vi.fn();
    render(
      <PasswordStrength password="correct horse battery staple" onScoreChange={onScoreChange} />,
    );
    await waitFor(() => expect(onScoreChange).toHaveBeenCalled());
    const lastScore = onScoreChange.mock.calls.at(-1)?.[0];
    expect(lastScore).toBeGreaterThanOrEqual(3);
  });

  it('reports score 0 when the password is cleared', async () => {
    const onScoreChange = vi.fn();
    const { rerender } = render(
      <PasswordStrength password="correct horse battery staple" onScoreChange={onScoreChange} />,
    );
    await waitFor(() => expect(onScoreChange).toHaveBeenCalled());
    onScoreChange.mockClear();
    rerender(<PasswordStrength password="" onScoreChange={onScoreChange} />);
    expect(onScoreChange).toHaveBeenCalledWith(0);
  });
});
