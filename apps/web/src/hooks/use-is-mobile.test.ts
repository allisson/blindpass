import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIsMobile } from './use-is-mobile';

function mockMatchMedia(matches: boolean) {
  const listeners: ((e: { matches: boolean }) => void)[] = [];
  const mq = {
    matches,
    addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => {
      listeners.push(fn);
    },
    removeEventListener: vi.fn(),
  };
  vi.spyOn(window, 'matchMedia').mockReturnValue(mq as unknown as MediaQueryList);
  return { listeners };
}

describe('useIsMobile', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns false when viewport is desktop width', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('returns true when viewport is mobile width', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('updates when matchMedia fires a change event', () => {
    const { listeners } = mockMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => {
      listeners.forEach((fn) => fn({ matches: true }));
    });

    expect(result.current).toBe(true);
  });

  it('cleans up the event listener on unmount', () => {
    const { listeners } = mockMatchMedia(false);
    const removeSpy = vi.fn();
    // Replace removeEventListener on the mq returned by matchMedia
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: false,
      addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => {
        listeners.push(fn);
      },
      removeEventListener: removeSpy,
    } as unknown as MediaQueryList);

    const { unmount } = renderHook(() => useIsMobile());
    unmount();
    expect(removeSpy).toHaveBeenCalledOnce();
  });
});
