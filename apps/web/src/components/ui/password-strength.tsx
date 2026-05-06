import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { loadZxcvbn, type Estimator, type StrengthScore } from '@/lib/zxcvbn';
import { cn } from '@/lib/utils';

const STRENGTH_LABELS = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'] as const;

type PasswordStrengthProps = {
  password: string;
  userInputs?: string[];
  showLabel?: boolean;
  className?: string;
  onScoreChange?: (score: StrengthScore) => void;
};

export function PasswordStrength({
  password,
  userInputs,
  showLabel = true,
  className,
  onScoreChange,
}: PasswordStrengthProps) {
  const [estimator, setEstimator] = useState<Estimator | null>(null);
  const [score, setScore] = useState<StrengthScore>(0);
  const [warning, setWarning] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [crackTime, setCrackTime] = useState('');
  const onScoreChangeRef = useRef(onScoreChange);
  onScoreChangeRef.current = onScoreChange;

  useEffect(() => {
    let cancelled = false;
    loadZxcvbn().then((fn) => {
      if (!cancelled) setEstimator(() => fn);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!password) {
      setScore(0);
      setWarning('');
      setSuggestion('');
      setCrackTime('');
      onScoreChangeRef.current?.(0);
      return;
    }
    if (!estimator) return;
    const result = estimator(password, userInputs);
    setScore(result.score);
    setWarning(result.warning);
    setSuggestion(result.suggestion);
    setCrackTime(result.crackTimeDisplay);
    onScoreChangeRef.current?.(result.score);
  }, [password, estimator, userInputs]);

  if (!password) return null;

  const label = STRENGTH_LABELS[score];
  const message = warning || suggestion;

  return (
    <div className={cn('flex flex-col gap-1.5', className)} aria-live="polite">
      <div className="pw-strength" data-score={score} aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      {showLabel && (
        <div className="flex items-baseline justify-between gap-2">
          <span
            className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground"
            data-testid="pw-strength-label"
          >
            {label}
          </span>
          {crackTime && (
            <span className="text-[10px] font-mono tabular-nums text-muted-foreground/70 truncate">
              {crackTime} to crack
            </span>
          )}
        </div>
      )}
      <AnimatePresence>
        {message && (
          <motion.p
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.15 }}
            className="text-[11px] text-muted-foreground overflow-hidden"
            data-testid="pw-strength-message"
          >
            {message}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
