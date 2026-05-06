import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { dbPlugin } from '../plugins/db.js';
import { authPlugin } from '../plugins/auth.js';
import { registerAuthRoutes } from '../routes/auth/index.js';
import { registerUserRoutes } from '../routes/user/index.js';
import { registerVaultRoutes } from '../routes/vaults/index.js';
import { registerAdminRoutes } from '../routes/admin/index.js';

export async function buildIntegrationApp() {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await app.register(cookie);
  await app.register(dbPlugin);
  await app.register(authPlugin);
  registerAuthRoutes(app);
  registerUserRoutes(app);
  registerVaultRoutes(app);
  registerAdminRoutes(app);
  return app;
}
