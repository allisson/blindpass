import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';
import { motion, useReducedMotion } from 'framer-motion';
import { BrandGlyph } from '@/components/Brand';
import { session } from '@/lib/session';

export const Route = createFileRoute('/_auth')({
  beforeLoad: () => {
    if (session.get()?.keychain) throw redirect({ to: '/' });
  },
  component: AuthLayout,
});

function AuthLayout() {
  const reduceMotion = useReducedMotion();
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Cipher grid — geometric background accent */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `
            linear-gradient(oklch(0.720 0.155 195 / 1) 1px, transparent 1px),
            linear-gradient(90deg, oklch(0.720 0.155 195 / 1) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 20%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 80% 80% at 50% 50%, black 20%, transparent 100%)',
        }}
      />
      {/* Radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: 'var(--glow-bg)' }}
      />
      <motion.div
        className="relative z-10 flex flex-col items-center w-full"
        initial={reduceMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.4, ease: 'easeOut' }}
      >
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 mb-4 shadow-[0_0_28px_oklch(0.580_0.210_295/0.25)]">
            <BrandGlyph className="w-7 h-7 text-foreground" ariaLabel="BlindPass" />
          </div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            Blind<span className="text-primary">Pass</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Zero-knowledge password manager</p>
        </div>
        <div className="w-full max-w-sm">
          <Outlet />
        </div>
      </motion.div>
    </div>
  );
}
