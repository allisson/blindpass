import { createFileRoute } from '@tanstack/react-router';
import { ExportSection } from '@/components/settings/ExportSection';
import { SettingsPage } from '@/components/settings/SettingsPage';

export const Route = createFileRoute('/_vault/settings/export')({
  component: ExportPage,
});

function ExportPage() {
  return (
    <SettingsPage
      title="Export"
      description="Download a backup of your vault. The encrypted format wraps every item under a passphrase you choose; the JSON format contains plaintext, so handle it accordingly."
    >
      <ExportSection />
    </SettingsPage>
  );
}
