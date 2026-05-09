import { createFileRoute } from '@tanstack/react-router';
import { AppearanceSection } from '@/components/settings/AppearanceSection';
import { SettingsPage } from '@/components/settings/SettingsPage';

export const Route = createFileRoute('/_vault/settings/appearance')({
  component: AppearancePage,
});

function AppearancePage() {
  return (
    <SettingsPage
      title="Appearance"
      description="Choose how BlindPass renders. System follows your operating system's prefers-color-scheme setting."
    >
      <AppearanceSection />
    </SettingsPage>
  );
}
