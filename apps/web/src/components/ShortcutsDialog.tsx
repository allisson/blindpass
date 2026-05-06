import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const SECTIONS = [
  {
    title: 'Global',
    rows: [
      { keys: ['⌘', 'K'], desc: 'Open command palette' },
      { keys: ['?'], desc: 'Show this overlay' },
    ],
  },
  {
    title: 'Vault list',
    rows: [
      { keys: ['/'], desc: 'Focus search' },
      { keys: ['↑', '↓'], desc: 'Navigate items' },
      { keys: ['j', 'k'], desc: 'Navigate items (vim)' },
      { keys: ['⌘', 'A'], desc: 'Select all visible' },
      { keys: ['⇧', 'click'], desc: 'Range select' },
      { keys: ['⌘', 'click'], desc: 'Toggle item in selection' },
      { keys: ['Esc'], desc: 'Clear selection' },
    ],
  },
  {
    title: 'Dashboard',
    rows: [{ keys: ['N'], desc: 'New item' }],
  },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShortcutsDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Speed up everything you do in BlindPass.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 mb-1.5">
                {section.title}
              </p>
              <ul className="space-y-1">
                {section.rows.map((row, i) => (
                  <li key={i} className="flex items-center justify-between text-sm py-0.5">
                    <span className="text-muted-foreground">{row.desc}</span>
                    <span className="flex items-center gap-1 shrink-0">
                      {row.keys.map((k, j) => (
                        <kbd
                          key={j}
                          className="font-mono text-[10px] border border-border bg-muted text-foreground rounded px-1.5 py-0.5"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
