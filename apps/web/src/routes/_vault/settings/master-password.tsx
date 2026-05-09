import { createFileRoute } from '@tanstack/react-router';
import { ChangePasswordSection } from '@/components/settings/ChangePasswordSection';
import { SettingsPage } from '@/components/settings/SettingsPage';

export const Route = createFileRoute('/_vault/settings/master-password')({
  component: MasterPasswordPage,
});

function MasterPasswordPage() {
  return (
    <SettingsPage
      title="Master password"
      description="Re-encrypts your master key with a new password. All active sessions are signed out on success."
    >
      <ChangePasswordSection />
    </SettingsPage>
  );
}
