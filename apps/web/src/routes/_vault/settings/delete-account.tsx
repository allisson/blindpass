import { createFileRoute } from '@tanstack/react-router';
import { DeleteAccountSection } from '@/components/settings/DeleteAccountSection';
import { SettingsPage } from '@/components/settings/SettingsPage';

export const Route = createFileRoute('/_vault/settings/delete-account')({
  component: DeleteAccountPage,
});

function DeleteAccountPage() {
  return (
    <SettingsPage
      title="Delete account"
      destructive
      description="Permanently removes your account, encrypted vaults, and all server-side material. Local browser data is wiped on sign-out. This cannot be undone, and BlindPass keeps no recovery copies."
    >
      <DeleteAccountSection />
    </SettingsPage>
  );
}
