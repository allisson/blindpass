import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';
import { BrandGlyph } from '@/components/Brand';
import { session } from '@/lib/session';

export const Route = createFileRoute('/_auth')({
  beforeLoad: () => {
    if (session.get()?.keychain) throw redirect({ to: '/' });
  },
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-7 gap-9 py-10">
      <div className="flex flex-col items-center gap-4">
        <BrandGlyph className="w-12 h-12" ariaLabel="BlindPass" />
        <div className="text-center">
          <h1
            className="text-[28px] font-bold tracking-[-0.02em] leading-none text-foreground"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Blind<span className="text-primary">Pass</span>
          </h1>
          <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mt-1">
            Zero-knowledge vault
          </p>
        </div>
      </div>
      <div className="w-full">
        <Outlet />
      </div>
    </div>
  );
}
