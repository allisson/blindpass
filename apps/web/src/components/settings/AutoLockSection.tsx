import { useState } from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { session } from '@/lib/session';

const AUTO_LOCK_OPTIONS = [
  { value: 5, label: '5 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 0, label: 'Never' },
] as const;

export function AutoLockSection() {
  const [minutes, setMinutes] = useState(() => session.getIdleMinutes());

  function handleChange(val: string | null) {
    if (val === null) return;
    const n = Number(val);
    setMinutes(n);
    session.setIdleMinutes(n);
    window.dispatchEvent(new CustomEvent('bp:auto-lock-change', { detail: n }));
  }

  return (
    <div className="field-group">
      <Label htmlFor="auto-lock">Lock after</Label>
      <Select value={String(minutes)} onValueChange={handleChange}>
        <SelectTrigger id="auto-lock" className="w-full max-w-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {AUTO_LOCK_OPTIONS.map(({ value, label }) => (
            <SelectItem key={value} value={String(value)}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
