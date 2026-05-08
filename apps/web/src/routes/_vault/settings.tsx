import { createFileRoute } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Download,
  Fingerprint,
  KeyRound,
  Lock,
  Rows3,
  Smartphone,
  Sun,
  Upload,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { AppearanceSection } from '@/components/settings/AppearanceSection';
import { DensitySection } from '@/components/settings/DensitySection';
import { AutoLockSection } from '@/components/settings/AutoLockSection';
import { VerificationIdSection } from '@/components/settings/VerificationIdSection';
import { ChangePasswordSection } from '@/components/settings/ChangePasswordSection';
import { ImportSection } from '@/components/settings/ImportSection';
import { ExportSection } from '@/components/settings/ExportSection';
import { DeleteAccountSection } from '@/components/settings/DeleteAccountSection';
import { InstallAppSection } from '@/components/settings/InstallAppSection';

export const Route = createFileRoute('/_vault/settings')({
  component: SettingsPage,
});

interface SectionProps {
  Icon: typeof Sun;
  title: string;
  description: string;
  destructive?: boolean;
  children: React.ReactNode;
}

function Section({ Icon, title, description, destructive, children }: SectionProps) {
  return (
    <section
      className={`rounded-xl border p-5 space-y-4 ${
        destructive ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-card'
      }`}
    >
      <div className="flex items-center gap-2">
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
            destructive
              ? 'bg-destructive/10 border border-destructive/30'
              : 'bg-primary/10 border border-primary/20'
          }`}
        >
          <Icon className={`w-3.5 h-3.5 ${destructive ? 'text-destructive' : 'text-primary'}`} />
        </div>
        <div>
          <h2
            className={`text-sm font-medium ${destructive ? 'text-destructive' : 'text-foreground'}`}
          >
            {title}
          </h2>
          <p className="text-[11px] text-muted-foreground mt-px">{description}</p>
        </div>
      </div>
      <Separator className={destructive ? 'border-destructive/20' : undefined} />
      {children}
    </section>
  );
}

function SettingsPage() {
  return (
    <motion.div
      className="max-w-xl mx-auto px-6 py-8 space-y-6"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <div>
        <h1 className="font-heading text-lg font-semibold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">Manage your account and security.</p>
      </div>

      <Section Icon={Sun} title="Appearance" description="Choose your preferred color theme.">
        <AppearanceSection />
      </Section>

      <Section Icon={Rows3} title="Density" description="Vertical breathing room in lists.">
        <DensitySection />
      </Section>

      <Section
        Icon={Lock}
        title="Auto-lock"
        description="Lock the vault after a period of inactivity."
      >
        <AutoLockSection />
      </Section>

      <Section
        Icon={Fingerprint}
        title="Verification ID"
        description="Share this 24-word fingerprint with someone before they share a vault with you. They should see the same words next to your username in their share dialog."
      >
        <VerificationIdSection />
      </Section>

      <Section
        Icon={KeyRound}
        title="Change master password"
        description="Re-encrypts your master key with a new password. All active sessions will be signed out."
      >
        <ChangePasswordSection />
      </Section>

      <Section
        Icon={Upload}
        title="Import passwords"
        description="Import items from Chrome, Firefox, LastPass, Bitwarden, or a BlindPass export."
      >
        <ImportSection />
      </Section>

      <Section
        Icon={Download}
        title="Export passwords"
        description="Export your vault as a backup file."
      >
        <ExportSection />
      </Section>

      <Section
        Icon={Smartphone}
        title="Install app"
        description="Add BlindPass to your home screen for quick access."
      >
        <InstallAppSection />
      </Section>

      <Section
        Icon={AlertTriangle}
        title="Danger zone"
        description="Permanent actions that cannot be undone."
        destructive
      >
        <DeleteAccountSection />
      </Section>
    </motion.div>
  );
}
