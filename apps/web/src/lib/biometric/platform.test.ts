import { afterEach, describe, expect, it, vi } from 'vitest';
import { getBiometricLabel } from './platform';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubNavigator(over: Partial<Navigator> & { userAgentData?: { platform?: string } }) {
  vi.stubGlobal('navigator', { userAgent: '', ...over } as unknown as Navigator);
}

describe('getBiometricLabel', () => {
  it('returns Touch ID on macOS via userAgentData', () => {
    stubNavigator({ userAgentData: { platform: 'macOS' }, userAgent: '' });
    expect(getBiometricLabel()).toBe('Touch ID');
  });

  it('returns Touch ID on macOS via userAgent fallback', () => {
    stubNavigator({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    });
    expect(getBiometricLabel()).toBe('Touch ID');
  });

  it('returns Face ID on iPhone', () => {
    stubNavigator({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
    });
    expect(getBiometricLabel()).toBe('Face ID');
  });

  it('returns Windows Hello on Windows via userAgentData', () => {
    stubNavigator({ userAgentData: { platform: 'Windows' }, userAgent: '' });
    expect(getBiometricLabel()).toBe('Windows Hello');
  });

  it('returns Windows Hello on Windows via userAgent fallback', () => {
    stubNavigator({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    });
    expect(getBiometricLabel()).toBe('Windows Hello');
  });

  it('falls back to "biometric" for unknown platforms', () => {
    stubNavigator({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' });
    expect(getBiometricLabel()).toBe('biometric');
  });
});
