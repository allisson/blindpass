import type { TotpItem } from '@blindpass/vault';

export type ParsedOtpauthUri = Pick<
  TotpItem,
  'secret' | 'issuer' | 'accountName' | 'algorithm' | 'digits' | 'period'
>;

const VALID_ALGORITHMS = ['SHA1', 'SHA256', 'SHA512'] as const;
type Algorithm = (typeof VALID_ALGORITHMS)[number];

export function parseOtpauthUri(uri: string): ParsedOtpauthUri | null {
  try {
    const url = new URL(uri);
    if (url.protocol !== 'otpauth:' || url.host !== 'totp') return null;

    const secret = url.searchParams.get('secret');
    if (!secret) return null;

    const rawAlgorithm = url.searchParams.get('algorithm')?.toUpperCase();
    const algorithm: Algorithm =
      rawAlgorithm && (VALID_ALGORITHMS as readonly string[]).includes(rawAlgorithm)
        ? (rawAlgorithm as Algorithm)
        : 'SHA1';

    const rawDigits = url.searchParams.get('digits');
    const digits = rawDigits ? parseInt(rawDigits, 10) : 6;

    const rawPeriod = url.searchParams.get('period');
    const period = rawPeriod ? parseInt(rawPeriod, 10) : 30;

    const issuer = url.searchParams.get('issuer') ?? undefined;

    // label is "issuer:accountName" or just "accountName"
    const label = decodeURIComponent(url.pathname.slice(1));
    const colonIdx = label.indexOf(':');
    const accountName = colonIdx !== -1 ? label.slice(colonIdx + 1).trim() : label || undefined;

    return { secret, issuer, accountName, algorithm, digits, period };
  } catch {
    return null;
  }
}
