import { Outlet, createFileRoute } from '@tanstack/react-router';
import { SettingsListPanel } from '@/components/settings/SettingsListPanel';

export const Route = createFileRoute('/_vault/settings')({
  component: SettingsLayout,
});

function SettingsLayout() {
  return (
    <div className="md:flex md:h-full">
      <aside className="hidden md:flex glass-list-panel w-56 shrink-0 flex-col">
        <SettingsListPanel />
      </aside>
      <div className="flex-1 md:overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
