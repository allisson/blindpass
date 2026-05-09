import { createFileRoute } from '@tanstack/react-router';
import { DensitySection } from '@/components/settings/DensitySection';
import { SettingsPage } from '@/components/settings/SettingsPage';

export const Route = createFileRoute('/_vault/settings/density')({
  component: DensityPage,
});

function DensityPage() {
  return (
    <SettingsPage
      title="Density"
      description="Vertical breathing room across lists, rows, and inputs. Compact fits more on screen; cozy is the default."
    >
      <DensitySection />
    </SettingsPage>
  );
}
