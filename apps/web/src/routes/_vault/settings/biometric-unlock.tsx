import { createFileRoute } from '@tanstack/react-router';
import { BiometricUnlockSection } from '@/components/settings/BiometricUnlockSection';
import { SettingsPage } from '@/components/settings/SettingsPage';

export const Route = createFileRoute('/_vault/settings/biometric-unlock')({
  component: BiometricUnlockPage,
});

function BiometricUnlockPage() {
  return (
    <SettingsPage
      title="Biometric unlock"
      description="Use Touch ID, Face ID, Windows Hello, or your Android biometric to unlock the vault on this device. Your master password is still required for sign-in and remains the canonical credential — biometric unlock is a per-device convenience that wraps your encryption keys locally and never leaves the device."
    >
      <BiometricUnlockSection />
    </SettingsPage>
  );
}
