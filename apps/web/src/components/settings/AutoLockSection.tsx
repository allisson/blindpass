import { useState } from 'react';
import { session } from '@/lib/session';

const AUTO_LOCK_OPTIONS = [
  { value: 5, label: '5 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 0, label: 'Never' },
] as const;

export function AutoLockSection() {
  const [minutes, setMinutes] = useState(() => session.getIdleMinutes());

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = Number(e.target.value);
    setMinutes(val);
    session.setIdleMinutes(val);
  }

  return (
    <select
      value={minutes}
      onChange={handleChange}
      aria-label="Auto-lock timeout"
      className="w-full max-w-xs h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
    >
      {AUTO_LOCK_OPTIONS.map(({ value, label }) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}
