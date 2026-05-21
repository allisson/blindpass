import { session } from './session';
import { vaultCache } from './vaultCache';
import { enrollmentStore } from './biometric';

session.subscribe(() => {
  const s = session.get();
  if (!s?.keychain) void vaultCache.clearAll().catch(() => {});
  if (!s) void enrollmentStore.clearAll().catch(() => {});
});
