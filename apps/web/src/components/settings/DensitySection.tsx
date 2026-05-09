import { KeyRound, Rows3, Rows4 } from 'lucide-react';
import { useId, useState } from 'react';
import { Label } from '@/components/ui/label';
import { applyDensity, loadDensity, type Density } from '@/lib/density';

const DENSITY_OPTIONS = [
  { value: 'cozy', label: 'Cozy', Icon: Rows3 },
  { value: 'compact', label: 'Compact', Icon: Rows4 },
] as const;

export function DensitySection() {
  const [density, setDensity] = useState<Density>(() => loadDensity());
  const groupId = useId();

  function handleChange(d: Density) {
    setDensity(d);
    applyDensity(d);
    window.dispatchEvent(new CustomEvent('bp:density-change', { detail: d }));
  }

  return (
    <div className="space-y-5">
      <div className="field-group">
        <Label id={groupId}>Row density</Label>
        <div className="flex gap-2" role="radiogroup" aria-labelledby={groupId}>
          {DENSITY_OPTIONS.map(({ value, label, Icon }) => {
            const selected = density === value;
            return (
              <button
                key={value}
                role="radio"
                aria-checked={selected}
                onClick={() => handleChange(value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
                  selected
                    ? 'bg-accent border-border text-foreground'
                    : 'border-border text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                }`}
              >
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>
      </div>
      <div data-density={density} className="rounded-lg border border-border bg-muted/30 p-2">
        <p className="px-2 pt-1 pb-1.5 text-caption text-muted-foreground/80">Preview</p>
        <div className="space-y-px">
          {SAMPLE_ROWS.map((row) => (
            <div
              key={row.title}
              className="flex items-center gap-2.5 rounded-md px-2 py-[var(--row-py)]"
            >
              <KeyRound className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm text-foreground">{row.title}</span>
              <span className="ml-auto text-xs text-muted-foreground font-mono">
                {row.subtitle}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const SAMPLE_ROWS = [
  { title: 'github.com', subtitle: 'allisson' },
  { title: 'aws · prod', subtitle: 'root' },
  { title: 'mailbox', subtitle: 'allisson@…' },
];
