import { useCallback, useEffect, useState } from 'react';
import { generateTotpCode, getTotpTimeRemaining } from '@blindpass/crypto';
import type { TotpItem } from '@blindpass/vault';

export function formatTotpCode(code: string): string {
  if (!code) return code;
  const mid = Math.ceil(code.length / 2);
  return `${code.slice(0, mid)} ${code.slice(mid)}`;
}

export function useTotpCode(item: Pick<TotpItem, 'secret' | 'algorithm' | 'digits' | 'period'>) {
  const [code, setCode] = useState('');
  const [remaining, setRemaining] = useState(item.period);

  const refresh = useCallback(() => {
    setCode(
      generateTotpCode(item.secret, {
        algorithm: item.algorithm,
        digits: item.digits,
        period: item.period,
      }),
    );
    setRemaining(getTotpTimeRemaining(item.period));
  }, [item.secret, item.algorithm, item.digits, item.period]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { code, remaining };
}
