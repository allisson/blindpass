import { useId } from 'react';
import type { ReactNode } from 'react';
import { Drawer } from 'vaul';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { cn } from '@/lib/utils';

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
  showCloseButton,
}: ResponsiveDialogProps) {
  const descId = useId();
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer.Root open={open} onOpenChange={onOpenChange}>
        <Drawer.Portal container={document.getElementById('app-shell')}>
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
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 isolate z-50 bg-black/10" />
        <DialogPrimitive.Popup
          className={cn(
            'fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 outline-none sm:max-w-sm',
            'data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
          )}
          aria-describedby={description ? descId : undefined}
        >
          <DialogPrimitive.Title className="text-base font-semibold text-foreground font-heading">
            {title}
          </DialogPrimitive.Title>
          {description && (
            <p id={descId} className="text-sm text-muted-foreground">
              {description}
            </p>
          )}
          {children}
          {footer && (
            <div className="-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end">
              {footer}
            </div>
          )}
          {showCloseButton && (
            <DialogPrimitive.Close
              render={
                <button
                  type="button"
                  className="absolute top-2 right-2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  aria-label="Close"
                />
              }
            >
              <span aria-hidden="true">×</span>
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
