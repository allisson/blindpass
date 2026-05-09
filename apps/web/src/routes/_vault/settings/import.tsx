import { createFileRoute } from '@tanstack/react-router';
import { ImportSection } from '@/components/settings/ImportSection';
import { SettingsPage } from '@/components/settings/SettingsPage';

export const Route = createFileRoute('/_vault/settings/import')({
  component: ImportPage,
});

function ImportPage() {
  return (
    <SettingsPage
      title="Import"
      description="Bring items in from Chrome, Firefox, LastPass, Bitwarden, or a BlindPass export. Files are read locally; nothing leaves your browser unencrypted."
    >
      <ImportSection />
    </SettingsPage>
  );
}
