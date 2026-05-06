import { Link } from '@tanstack/react-router';
import { Check, ChevronRight, KeyRound, Sparkles, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'bp:onboarding:steps';
const STEP_GENERATE = 'generate';

type StepId = typeof STEP_GENERATE | 'save';

function loadCompleted(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

function saveCompleted(set: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
}

export function OnboardingEmpty() {
  const [done, setDone] = useState<Set<string>>(() => loadCompleted());

  useEffect(() => {
    saveCompleted(done);
  }, [done]);

  function mark(step: typeof STEP_GENERATE) {
    setDone((prev) => {
      if (prev.has(step)) return prev;
      const next = new Set(prev);
      next.add(step);
      return next;
    });
  }

  const generateDone = done.has(STEP_GENERATE);

  const steps: Array<{
    id: StepId;
    title: string;
    desc: string;
    Icon: typeof KeyRound;
    cta: React.ReactNode;
    completed: boolean;
  }> = [
    {
      id: STEP_GENERATE,
      title: 'Generate a strong password',
      desc: 'When adding a login, the dice icon opens the built-in generator.',
      Icon: Sparkles,
      completed: generateDone,
      cta: generateDone ? null : (
        <button
          type="button"
          onClick={() => mark(STEP_GENERATE)}
          className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-0.5"
        >
          Got it <ChevronRight className="w-3 h-3" />
        </button>
      ),
    },
    {
      id: 'save',
      title: 'Save your first login',
      desc: 'Add a site, username, and password — encrypted before it leaves your device.',
      Icon: KeyRound,
      completed: false,
      cta: (
        <Link
          to="/items/new"
          className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-0.5"
        >
          New item <ChevronRight className="w-3 h-3" />
        </Link>
      ),
    },
  ];

  return (
    <div className="px-3 py-6" data-testid="onboarding-empty">
      <div className="text-center mb-4">
        <p className="text-sm font-medium text-foreground">Welcome to your vault</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Two steps to get the most out of BlindPass.
        </p>
        <Link
          to="/settings"
          className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <Upload className="w-3 h-3" />
          Or import from another manager
        </Link>
      </div>
      <ol className="space-y-2">
        {steps.map((step, i) => (
          <li
            key={step.id}
            data-testid={`onboarding-step-${step.id}`}
            className={`relative rounded-lg border px-3 py-2.5 transition-colors ${
              step.completed
                ? 'border-primary/30 bg-primary/5'
                : 'border-border/60 bg-background/40'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <span
                className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-mono font-semibold ${
                  step.completed
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
                aria-hidden="true"
              >
                {step.completed ? <Check className="w-3 h-3" /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground leading-tight">{step.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{step.desc}</p>
                {step.cta && <div className="mt-1.5">{step.cta}</div>}
              </div>
              <step.Icon className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 mt-0.5" />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
