import { createFileRoute } from '@tanstack/react-router';
import { SettingsListPanel } from '@/components/settings/SettingsListPanel';

export const Route = createFileRoute('/_vault/settings/')({
  component: SettingsIndex,
});

function SettingsIndex() {
  return <SettingsListPanel />;
}
