import { Rows3, Rows4 } from 'lucide-react';
import { useState } from 'react';
import { applyDensity, loadDensity, type Density } from '@/lib/density';

const DENSITY_OPTIONS = [
  { value: 'cozy', label: 'Cozy', Icon: Rows3 },
  { value: 'compact', label: 'Compact', Icon: Rows4 },
] as const;

export function DensitySection() {
  const [density, setDensity] = useState<Density>(() => loadDensity());

  function handleChange(d: Density) {
    setDensity(d);
    applyDensity(d);
  }

  return (
    <div className="flex gap-2" role="radiogroup" aria-label="Row density">
      {DENSITY_OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          role="radio"
          aria-checked={density === value}
          onClick={() => handleChange(value)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            density === value
              ? 'bg-primary/10 border-primary/30 text-primary'
              : 'border-border text-muted-foreground hover:text-foreground hover:border-border/80'
          }`}
        >
          <Icon className="w-3 h-3" aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}
