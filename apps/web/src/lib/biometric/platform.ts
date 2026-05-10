/**
 * Returns a human-readable label for the platform's biometric verifier.
 * Used only for button copy ("Unlock with <label>"); does not change behaviour.
 */
export function getBiometricLabel(): string {
  if (typeof navigator === 'undefined') return 'biometric';
  const ua = navigator.userAgent;
  const platform = (
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
    ''
  ).toLowerCase();

  if (platform.includes('mac') || /Macintosh/i.test(ua)) return 'Touch ID';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'Face ID';
  if (platform.includes('windows') || /Windows/i.test(ua)) return 'Windows Hello';
  return 'biometric';
}
