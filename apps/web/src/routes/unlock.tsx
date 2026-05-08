import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, LockOpen } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, ApiError } from '@/lib/api';
import { unlockWithPassword } from '@/lib/keychain';
import { fetchAllPages } from '@/lib/fetchAllPages';
import { session, getLastUsername, clearLastUsername } from '@/lib/session';
import { buildVaultsMap } from '@/lib/vaultUtils';
import { vaultCache } from '@/lib/vaultCache';

export const Route = createFileRoute('/unlock')({
  beforeLoad: () => {
    const s = session.get();
    if (s?.keychain) throw redirect({ to: '/' });
  },
  component: UnlockPage,
});

const schema = z.object({
  password: z.string().min(1, 'Password is required'),
});

type FormData = z.infer<typeof schema>;

function UnlockPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const reduceMotion = useReducedMotion();
  const isRestore = !session.get();
  const restoreUsername = isRestore ? getLastUsername() : null;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: standardSchemaResolver(schema) });

  async function onSubmit(data: FormData) {
    setError(null);
    const sBefore = session.get();
    let masterKey: Uint8Array | undefined;
    let privateKey: Uint8Array | undefined;

    try {
      setLoadingMsg('Fetching keys…');
      let keysData;
      let vaults;
      try {
        [keysData, vaults] = await Promise.all([
          api.getKeys(),
          fetchAllPages((cursor) =>
            api.getVault(cursor).then((r) => ({ data: r.vaults, nextCursor: r.nextCursor })),
          ),
        ]);
      } catch (err) {
        // Cookie missing/expired or session revoked — full login required.
        if (err instanceof ApiError && err.status === 401) {
          session.clear();
          await vaultCache.clearAll().catch(() => {});
          qc.clear();
          navigate({ to: '/login' });
          return;
        }
        throw err;
      }
      const ownedVault = vaults.find((v) => !v.isShared);
      if (!ownedVault) throw new Error('No vault found.');

      setLoadingMsg('Decrypting vault…');
      const unlocked = await unlockWithPassword(data.password, keysData);
      masterKey = unlocked.masterKey;
      privateKey = unlocked.keyPair.privateKey;
      const keyPair = unlocked.keyPair;

      const vaultsMap = await buildVaultsMap(vaults, masterKey, keyPair);
      const activeVaultId = ownedVault.id;
      const keychain = { masterKey, vaultKey: vaultsMap.get(activeVaultId)!.vaultKey };
      const username = sBefore?.username ?? getLastUsername() ?? undefined;

      session.set({ username, activeVaultId, vaults: vaultsMap, keychain, keyPair });
      navigate({ to: '/' });
    } catch (err) {
      masterKey?.fill(0);
      privateKey?.fill(0);
      if (!sBefore) session.clear();
      setLoadingMsg('');
      setError(err instanceof Error ? err.message : 'Unlock failed');
    }
  }

  async function handleSignOut() {
    try {
      await api.logout();
    } catch {
      // best-effort — server session may already be gone
    }
    session.clear();
    clearLastUsername();
    await vaultCache.clearAll().catch(() => {});
    qc.clear();
    navigate({ to: '/login' });
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Cipher grid */}
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
          <motion.div
            className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-4"
            animate={
              reduceMotion
                ? {}
                : loadingMsg
                  ? {
                      scale: 1.08,
                      backgroundColor: 'oklch(0.75 0.18 80 / 0.18)',
                      boxShadow: '0 0 48px oklch(0.75 0.18 80 / 0.45)',
                    }
                  : {
                      scale: 1,
                      backgroundColor: 'oklch(0.75 0.18 80 / 0.10)',
                      boxShadow: '0 0 28px oklch(0.75 0.18 80 / 0.20)',
                    }
            }
            transition={reduceMotion ? { duration: 0 } : { duration: 0.45, ease: 'easeOut' }}
          >
            <motion.span
              animate={reduceMotion ? {} : { rotate: loadingMsg ? -18 : 0 }}
              transition={
                reduceMotion ? { duration: 0 } : { duration: 0.4, ease: [0.16, 1, 0.3, 1] }
              }
              className="inline-flex"
            >
              <LockOpen className="w-6 h-6 text-amber-500" />
            </motion.span>
          </motion.div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Vault locked</h1>
          <p className="text-xs text-muted-foreground mt-1">Enter your master password to unlock</p>
        </div>

        <div className="w-full max-w-sm">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Unlock vault</CardTitle>
              <CardDescription>
                {isRestore
                  ? `Enter your master password to resume as ${restoreUsername}`
                  : 'Your session is still active — no need to sign in again'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={handleSubmit(onSubmit)}
                className="space-y-4"
                aria-busy={!!loadingMsg || isSubmitting}
              >
                <div className="field-group" data-invalid={!!errors.password}>
                  <Label htmlFor="password">Master password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      autoFocus
                      className="pr-9"
                      disabled={!!loadingMsg || isSubmitting}
                      aria-invalid={!!errors.password}
                      {...register('password')}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword((v) => !v)}
                      disabled={!!loadingMsg || isSubmitting}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <FieldError message={errors.password?.message} />
                </div>
                <FieldError message={error ?? undefined} data-testid="error-message" />
                <Button
                  type="submit"
                  className="w-full"
                  loading={!!loadingMsg || isSubmitting}
                  disabled={!!loadingMsg || isSubmitting}
                >
                  {loadingMsg || (isSubmitting ? 'Unlocking…' : 'Unlock vault')}
                </Button>
              </form>
              <div className="mt-4 flex flex-col items-center gap-2 text-center">
                <p className="text-[11px] text-muted-foreground/80">
                  Decryption happens on this device. We never see your master password.
                </p>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Sign out instead
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </div>
  );
}
