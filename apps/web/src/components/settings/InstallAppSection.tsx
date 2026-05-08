import { Check, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWAInstall } from '@/hooks/usePWAInstall';

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches;
}

export function InstallAppSection() {
  const { canInstall, install } = usePWAInstall();

  if (isStandalone()) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 border border-primary/20 text-primary">
          <Check className="w-3 h-3" />
          Already installed
        </span>
      </div>
    );
  }

  if (canInstall) {
    return (
      <Button size="sm" variant="outline" onClick={() => void install()}>
        <Smartphone className="w-3.5 h-3.5 mr-1.5" />
        Install BlindPass
      </Button>
    );
  }

  if (isIOS()) {
    return (
      <p className="text-xs text-muted-foreground">
        Tap the <strong>Share</strong> button in Safari, then choose{' '}
        <strong>Add to Home Screen</strong>.
      </p>
    );
  }

  return (
    <p className="text-xs text-muted-foreground">
      Use your browser's install option (address bar or menu) to add BlindPass to your device.
    </p>
  );
}
