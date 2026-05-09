import { createFileRoute } from '@tanstack/react-router';
import { SettingsPage } from '@/components/settings/SettingsPage';
import { VerificationIdSection } from '@/components/settings/VerificationIdSection';

export const Route = createFileRoute('/_vault/settings/verification-id')({
  component: VerificationIdPage,
});

function VerificationIdPage() {
  return (
    <SettingsPage
      title="Verification ID"
      description="A 24-word fingerprint of your public key. Share it with someone before they share a vault with you. They should see the same words next to your username in their share dialog."
    >
      <VerificationIdSection />
    </SettingsPage>
  );
}
