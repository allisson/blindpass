import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTotpCode } from './useTotpCode';

vi.mock('@blindpass/crypto', () => ({
  generateTotpCode: vi.fn(),
  getTotpTimeRemaining: vi.fn(),
}));

import { generateTotpCode, getTotpTimeRemaining } from '@blindpass/crypto';

const item = {
  secret: 'JBSWY3DPEHPK3PXP',
  algorithm: 'SHA1' as const,
  digits: 6 as const,
  period: 30,
};

describe('useTotpCode', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(generateTotpCode).mockReturnValue('123456');
    vi.mocked(getTotpTimeRemaining).mockReturnValue(25);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('computes the code and remaining synchronously on mount', () => {
    const { result } = renderHook(() => useTotpCode(item));
    expect(result.current.code).toBe('123456');
    expect(result.current.remaining).toBe(25);
  });

  it('refreshes every second', () => {
    const { result } = renderHook(() => useTotpCode(item));

    vi.mocked(generateTotpCode).mockReturnValue('654321');
    vi.mocked(getTotpTimeRemaining).mockReturnValue(24);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.code).toBe('654321');
    expect(result.current.remaining).toBe(24);

    vi.mocked(generateTotpCode).mockReturnValue('111222');
    vi.mocked(getTotpTimeRemaining).mockReturnValue(23);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.code).toBe('111222');
    expect(result.current.remaining).toBe(23);
  });

  it('passes algorithm, digits, and period through to generateTotpCode', () => {
    renderHook(() => useTotpCode(item));
    expect(generateTotpCode).toHaveBeenCalledWith('JBSWY3DPEHPK3PXP', {
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    });
  });

  it('clears the interval on unmount', () => {
    const { unmount } = renderHook(() => useTotpCode(item));
    vi.mocked(generateTotpCode).mockClear();
    unmount();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(generateTotpCode).not.toHaveBeenCalled();
  });

  it('recomputes when the secret changes', () => {
    const { rerender } = renderHook(({ i }) => useTotpCode(i), {
      initialProps: { i: item },
    });
    vi.mocked(generateTotpCode).mockClear();
    rerender({ i: { ...item, secret: 'NEWSECRET' } });
    expect(generateTotpCode).toHaveBeenCalledWith(
      'NEWSECRET',
      expect.objectContaining({ algorithm: 'SHA1' }),
    );
  });
});
