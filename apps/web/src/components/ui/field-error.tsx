import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type FieldErrorProps = {
  id?: string;
  message?: string;
  className?: string;
  align?: 'start' | 'center';
  'data-testid'?: string;
};

export function FieldError({
  id,
  message,
  className,
  align = 'start',
  'data-testid': testId,
}: FieldErrorProps) {
  return (
    <AnimatePresence>
      {message && (
        <motion.p
          id={id}
          role="alert"
          data-testid={testId}
          initial={{ opacity: 0, y: -4, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -4, height: 0 }}
          transition={{ duration: 0.15 }}
          className={cn(
            'flex items-center gap-1.5 text-xs text-destructive overflow-hidden',
            align === 'center' && 'justify-center',
            className,
          )}
        >
          <AlertCircle className="w-3 h-3 shrink-0" aria-hidden="true" />
          <span>{message}</span>
        </motion.p>
      )}
    </AnimatePresence>
  );
}
