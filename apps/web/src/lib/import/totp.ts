export interface TotpFields {
  secret: string;
  issuer?: string;
  accountName?: string;
  algorithm?: 'SHA1' | 'SHA256' | 'SHA512';
  digits?: number;
  period?: number;
}

export function parseTotpUri(uri: string): TotpFields | null {
  const trimmed = uri.trim();
  if (!trimmed) return null;

  if (!trimmed.startsWith('otpauth://')) {
    return { secret: trimmed };
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'otpauth:') return null;
    const secret = url.searchParams.get('secret');
    if (!secret) return null;

    const label = decodeURIComponent(url.pathname.slice(1));
    const colonIdx = label.indexOf(':');
    const issuerFromPath = colonIdx !== -1 ? label.slice(0, colonIdx) : undefined;
    const accountName = colonIdx !== -1 ? label.slice(colonIdx + 1) : label;

    const issuer = url.searchParams.get('issuer') ?? issuerFromPath;
    const rawAlgo = url.searchParams.get('algorithm');
    const algorithm =
      rawAlgo === 'SHA256' || rawAlgo === 'SHA512' ? rawAlgo : rawAlgo ? 'SHA1' : undefined;
    const digits = url.searchParams.get('digits')
      ? Number(url.searchParams.get('digits'))
      : undefined;
    const period = url.searchParams.get('period')
      ? Number(url.searchParams.get('period'))
      : undefined;

    return {
      secret,
      issuer: issuer ?? undefined,
      accountName: accountName || undefined,
      algorithm,
      digits,
      period,
    };
  } catch {
    return null;
  }
}
