import { Outlet, createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_vault/settings')({
  component: SettingsLayout,
});

function SettingsLayout() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
}
