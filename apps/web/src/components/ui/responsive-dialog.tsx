import { useId } from 'react';
import type { ReactNode } from 'react';
import { Drawer } from 'vaul';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-is-mobile';

interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  showCloseButton?: boolean;
}

export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  showCloseButton = false,
}: ResponsiveDialogProps) {
  const descId = useId();
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer.Root open={open} onOpenChange={onOpenChange}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-40 bg-black/50" />
          <Drawer.Content
            className="fixed bottom-0 inset-x-0 z-50 flex flex-col rounded-t-2xl bg-popover border-t border-border outline-none"
            aria-describedby={description ? descId : undefined}
          >
            <div className="mx-auto mt-3 mb-2 h-1 w-10 rounded-full bg-border shrink-0" />
            <div className="px-6 pt-1">
              <Drawer.Title className="text-base font-semibold text-foreground font-heading">
                {title}
              </Drawer.Title>
              {description && (
                <p id={descId} className="text-sm text-muted-foreground mt-1.5">
                  {description}
                </p>
              )}
            </div>
            {children && <div className="px-6 mt-3">{children}</div>}
            {footer && (
              <div
                className="px-6 pt-4 mt-4 flex flex-col gap-2 border-t border-border [&>button]:w-full [&>a]:w-full"
                style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
              >
                {footer}
              </div>
            )}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={showCloseButton}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
