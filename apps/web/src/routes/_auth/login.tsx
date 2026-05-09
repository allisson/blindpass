import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { api } from '@/lib/api';
import { authFlow } from '@/lib/authFlow';
import { getLastUsername } from '@/lib/session';

export const Route = createFileRoute('/_auth/login')({
  component: LoginPage,
});

const schema = z.object({
  username: z.string().regex(/^[a-z0-9_]{3,32}$/, 'Use 3-32 lowercase letters, numbers, or _'),
  password: z.string().min(1, 'Required'),
});

type FormData = z.infer<typeof schema>;

function LoginPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: standardSchemaResolver(schema),
    defaultValues: { username: getLastUsername() ?? '', password: '' },
  });

  async function onSubmit(data: FormData) {
    setError(null);
    try {
      await api.startLogin({ username: data.username });
      authFlow.setLogin({ username: data.username, password: data.password });
      navigate({ to: '/authenticator', search: { mode: 'login', username: data.username } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start sign in');
    }
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          Enter your username, then confirm with your authenticator app
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" aria-busy={isSubmitting}>
          <div className="field-group" data-invalid={!!errors.username}>
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              autoComplete="username"
              autoFocus
              placeholder="blindpass_user"
              aria-invalid={!!errors.username}
              aria-describedby={errors.username ? 'username-error' : undefined}
              {...register('username')}
            />
            <FieldError id="username-error" message={errors.username?.message} />
          </div>
          <div className="field-group" data-invalid={!!errors.password}>
            <Label htmlFor="password">Master password</Label>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'password-error' : undefined}
              {...register('password')}
            />
            <FieldError id="password-error" message={errors.password?.message} />
          </div>
          <FieldError message={error ?? undefined} />
          <Button type="submit" className="w-full" loading={isSubmitting} disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Continue'}
          </Button>
          <nav className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <Link to="/register" className="transition-colors hover:text-foreground">
              Create account
            </Link>
            <span aria-hidden="true">·</span>
            <Link to="/recover" className="transition-colors hover:text-foreground">
              Recover access
            </Link>
          </nav>
        </form>
      </CardContent>
    </Card>
  );
}
