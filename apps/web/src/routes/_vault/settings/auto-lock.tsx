import { createFileRoute } from '@tanstack/react-router';
import { AutoLockSection } from '@/components/settings/AutoLockSection';
import { SettingsPage } from '@/components/settings/SettingsPage';

export const Route = createFileRoute('/_vault/settings/auto-lock')({
  component: AutoLockPage,
});

function AutoLockPage() {
  return (
    <SettingsPage
      title="Auto-lock"
      description="Lock the vault after a period of inactivity. The countdown resets on keyboard, pointer, or touch input, and locking applies across every open tab."
    >
      <AutoLockSection />
    </SettingsPage>
  );
}
