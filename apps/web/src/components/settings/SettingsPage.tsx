import { Link } from '@tanstack/react-router';
import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';

interface SettingsPageProps {
  title: string;
  description?: ReactNode;
  destructive?: boolean;
  children: ReactNode;
}

export function SettingsPage({ title, description, destructive, children }: SettingsPageProps) {
  return (
    <div className="max-w-[40rem] mx-auto px-6 md:px-10 py-6 md:py-10">
      <Link
        to="/settings"
        className="md:hidden inline-flex items-center gap-1 -ml-1 mb-4 px-1 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Settings
      </Link>
      <header className="space-y-2">
        <h1
          className={`font-heading text-2xl font-medium tracking-tight ${
            destructive ? 'text-destructive' : 'text-foreground'
          }`}
        >
          {title}
        </h1>
        {description ? (
          <p className="text-sm text-muted-foreground max-w-[68ch] leading-relaxed">
            {description}
          </p>
        ) : null}
      </header>
      <div className="mt-7">{children}</div>
    </div>
  );
}
