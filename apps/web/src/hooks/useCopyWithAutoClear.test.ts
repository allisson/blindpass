import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCopyWithAutoClear } from './useCopyWithAutoClear';

describe('useCopyWithAutoClear', () => {
  const mockWriteText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: mockWriteText },
      writable: true,
      configurable: true,
    });
    mockWriteText.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
  });

  it('copies text to clipboard', async () => {
    const { result } = renderHook(() => useCopyWithAutoClear());
    await act(async () => {
      await result.current('hello');
    });
    expect(mockWriteText).toHaveBeenCalledWith('hello');
  });

  it('clears clipboard after ttl', async () => {
    const { result } = renderHook(() => useCopyWithAutoClear(1000));
    await act(async () => {
      await result.current('secret');
    });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(mockWriteText).toHaveBeenLastCalledWith('');
  });

  it('cancels previous timer when called again before expiry', async () => {
    const { result } = renderHook(() => useCopyWithAutoClear(1000));
    await act(async () => {
      await result.current('first');
    });
    await act(async () => {
      await result.current('second');
    });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    const clearCalls = mockWriteText.mock.calls.filter((c) => c[0] === '');
    expect(clearCalls).toHaveLength(1);
  });

  it('does not clear clipboard after unmount cancels the timer', async () => {
    const { result, unmount } = renderHook(() => useCopyWithAutoClear(5000));
    await act(async () => {
      await result.current('data');
    });
    unmount();
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    const clearCalls = mockWriteText.mock.calls.filter((c) => c[0] === '');
    expect(clearCalls).toHaveLength(0);
  });

  it('does nothing when visibilitychange fires but page is not hidden', async () => {
    const { result } = renderHook(() => useCopyWithAutoClear(5000));
    await act(async () => {
      await result.current('secret');
    });

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    const clearCalls = mockWriteText.mock.calls.filter((c) => c[0] === '');
    expect(clearCalls).toHaveLength(0);

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    const clearCallsAfter = mockWriteText.mock.calls.filter((c) => c[0] === '');
    expect(clearCallsAfter).toHaveLength(1);
  });

  it('clears clipboard immediately and cancels timer when page becomes hidden', async () => {
    const { result } = renderHook(() => useCopyWithAutoClear(5000));
    await act(async () => {
      await result.current('secret');
    });

    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(mockWriteText).toHaveBeenLastCalledWith('');

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    const clearCalls = mockWriteText.mock.calls.filter((c) => c[0] === '');
    expect(clearCalls).toHaveLength(1);
  });
});
