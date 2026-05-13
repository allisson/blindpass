import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_vault/')({
  component: VaultIndexPage,
});

function VaultIndexPage() {
  return null;
}
