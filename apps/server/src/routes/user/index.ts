import type { FastifyInstance } from 'fastify';
import { registerChangePasswordRoute } from './change-password.js';
import { registerCompleteTotpRotationRoute } from './complete-totp-rotation.js';
import { registerDeleteAccountRoute } from './delete-account.js';
import { registerUserKeysRoute } from './keys.js';
import { registerLookupByUsernameRoute } from './lookup-by-username.js';
import { registerRotateRecoveryPhraseRoute } from './rotate-recovery-phrase.js';
import { registerStartTotpRotationRoute } from './start-totp-rotation.js';

export function registerUserRoutes(app: FastifyInstance): void {
  registerUserKeysRoute(app);
  registerChangePasswordRoute(app);
  registerDeleteAccountRoute(app);
  registerLookupByUsernameRoute(app);
  registerRotateRecoveryPhraseRoute(app);
  registerStartTotpRotationRoute(app);
  registerCompleteTotpRotationRoute(app);
}
