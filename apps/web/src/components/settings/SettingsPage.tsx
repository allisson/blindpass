import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

interface SettingsPageProps {
  title: string;
  description?: ReactNode;
  destructive?: boolean;
  children: ReactNode;
}

export function SettingsPage({ title, description, destructive, children }: SettingsPageProps) {
  return (
    <>
      <div className="h-14 bg-card border-b border-border sticky top-0 z-10 flex items-center px-4 gap-3">
        <Link
          to="/settings"
          aria-label="Back to Settings"
          className="text-primary shrink-0 touch-manipulation flex items-center"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1
          className={`text-[16px] font-bold tracking-[-0.01em] truncate flex-1 ${
            destructive ? 'text-destructive' : 'text-foreground'
          }`}
        >
          {title}
        </h1>
      </div>
      <div className="px-6 py-4">
        {description ? (
          <p className="text-[13px] text-muted-foreground mb-5 leading-relaxed">{description}</p>
        ) : null}
        {children}
      </div>
    </>
  );
}
