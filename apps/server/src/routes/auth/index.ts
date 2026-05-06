import type { FastifyInstance } from 'fastify';
import { registerRegisterRoute } from './register.js';
import { registerCompleteRegistrationRoute } from './complete-registration.js';
import { registerStartLoginRoute } from './start-login.js';
import { registerCompleteLoginRoute } from './complete-login.js';
import { registerStartRecoveryRoute } from './start-recovery.js';
import { registerVerifyRecoveryRoute } from './verify-recovery.js';
import { registerCompleteRecoveryRoute } from './complete-recovery.js';
import { registerSessionsRoutes } from './sessions.js';
import { registerLogoutRoute } from './logout.js';

export function registerAuthRoutes(app: FastifyInstance): void {
  registerRegisterRoute(app);
  registerCompleteRegistrationRoute(app);
  registerStartLoginRoute(app);
  registerCompleteLoginRoute(app);
  registerStartRecoveryRoute(app);
  registerVerifyRecoveryRoute(app);
  registerCompleteRecoveryRoute(app);
  registerSessionsRoutes(app);
  registerLogoutRoute(app);
}
