import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { dbPlugin } from '../plugins/db.js';
import { clockPlugin } from '../plugins/clock.js';
import { authPlugin } from '../plugins/auth.js';
import { errorHandler } from '../error-handler.js';
import { registerAuthRoutes } from '../routes/auth/index.js';
import { registerUserRoutes } from '../routes/user/index.js';
import { registerVaultRoutes } from '../routes/vaults/index.js';
import { registerAdminRoutes } from '../routes/admin/index.js';

export async function buildIntegrationApp() {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  // Match production wiring: the global error handler maps PG 23505 → 409 and
  // QuotaExceededError → 403. Integration tests assert these HTTP shapes; the
  // production server registers it in src/index.ts.
  app.setErrorHandler(errorHandler);
  await app.register(cookie);
  await app.register(dbPlugin);
  await app.register(clockPlugin);
  await app.register(authPlugin);
  registerAuthRoutes(app);
  registerUserRoutes(app);
  registerVaultRoutes(app);
  registerAdminRoutes(app);
  return app;
}
