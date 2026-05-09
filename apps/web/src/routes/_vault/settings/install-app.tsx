import { createFileRoute } from '@tanstack/react-router';
import { InstallAppSection } from '@/components/settings/InstallAppSection';
import { SettingsPage } from '@/components/settings/SettingsPage';

export const Route = createFileRoute('/_vault/settings/install-app')({
  component: InstallAppPage,
});

function InstallAppPage() {
  return (
    <SettingsPage
      title="Install app"
      description="Add BlindPass to your home screen. Behaviour depends on your browser; on iOS Safari, use Share, then Add to Home Screen."
    >
      <InstallAppSection />
    </SettingsPage>
  );
}
