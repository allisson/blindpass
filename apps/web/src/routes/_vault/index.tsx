import { createFileRoute } from '@tanstack/react-router';
import { Command } from 'lucide-react';

export const Route = createFileRoute('/_vault/')({
  component: VaultIndexPage,
});

function VaultIndexPage() {
  return (
    <div className="hidden md:flex h-full items-center justify-center px-6">
      <p className="text-xs text-muted-foreground/70 inline-flex items-center gap-2">
        Select an item, or
        <kbd className="font-mono text-[10px] border border-border/60 rounded px-1 py-px inline-flex items-center gap-0.5">
          <Command className="w-2.5 h-2.5" />K
        </kbd>
        to search.
      </p>
    </div>
  );
}
