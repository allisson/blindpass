import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RecoveryKeyDisplay } from '@/components/vault/RecoveryKeyDisplay';
import { authFlow } from '@/lib/authFlow';
import { session } from '@/lib/session';

export const Route = createFileRoute('/_auth/recovery-key')({
  component: RecoveryKeyPage,
});

function RecoveryKeyPage() {
  const navigate = useNavigate();
  const [recoveryKey] = useState(() => authFlow.getRecoveryKey());
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!recoveryKey) {
      navigate({ to: '/login' });
    }
  }, [recoveryKey, navigate]);

  useEffect(() => {
    return () => {
      authFlow.clearRecoveryKey();
    };
  }, []);

  if (!recoveryKey) return null;

  return (
    <Card className="auth-card">
      <CardHeader>
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <CardTitle>Save your recovery key</CardTitle>
        </div>
        <CardDescription>
          Lose your password without this key and your vault is gone. Not even we can recover it —
          that's the point. Store it offline, somewhere only you can find. You won't see it again.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RecoveryKeyDisplay mnemonic={recoveryKey} />
        <div className="flex items-start gap-2.5">
          <input
            type="checkbox"
            id="confirm-saved"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 cursor-pointer rounded border border-input accent-primary"
          />
          <label
            htmlFor="confirm-saved"
            className="text-sm text-muted-foreground cursor-pointer leading-snug"
          >
            I have saved my recovery key in a safe place
          </label>
        </div>
        <Button
          className="w-full"
          disabled={!confirmed}
          onClick={() => {
            authFlow.clearRecoveryKey();
            const pending = authFlow.getPendingSession();
            if (pending) {
              session.set(pending);
              authFlow.clearPendingSession();
            }
            navigate({ to: '/' });
          }}
        >
          I've saved my recovery key
        </Button>
      </CardContent>
    </Card>
  );
}
