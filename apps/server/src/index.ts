import Fastify from 'fastify';
import compress from '@fastify/compress';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import { lt, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { env } from './env.js';
import { dbPlugin } from './plugins/db.js';
import { authPlugin } from './plugins/auth.js';
import { registerAdminRoutes } from './routes/admin/index.js';
import { registerAuthRoutes } from './routes/auth/index.js';
import { registerUserRoutes } from './routes/user/index.js';
import { registerVaultRoutes } from './routes/vaults/index.js';
import { errorHandler } from './error-handler.js';
import { pendingTotpEnrollments, recoveryTokens, sessions } from './db/schema.js';

const mode = process.argv[2] ?? 'server';

if (mode === 'migrate') {
  console.log('Running database migrations…');
  const pool = new Pool({ connectionString: env.DATABASE_URL, max: env.DB_POOL_MAX });
  await migrate(drizzle(pool), { migrationsFolder: './src/db/migrations' });
  await pool.end();
  console.log('Migrations complete.');
} else {
  const app = Fastify({
    routerOptions: { ignoreTrailingSlash: true },
    bodyLimit: env.BODY_LIMIT_BYTES,
    logger: {
      level: env.LOG_LEVEL,
      // Convention: redact every request field that may carry plaintext PII or
      // ciphertext blobs. Pino/fast-redact only supports full-segment '*' / '[*]',
      // so each field is enumerated explicitly.
      redact: [
        'req.headers.authorization',
        'req.body.code',
        'req.body.authenticatorCode',
        'req.body.username',
        'req.query.username',
        'req.body.recoveryToken',
        'req.body.recoveryVerifier',
        'req.body.setupKey',
        'req.body.encryptedMasterKey',
        'req.body.encryptedMasterKeyForRecovery',
        'req.body.encryptedPrivateKey',
        'req.body.encryptedRecoveryKey',
        'req.body.encryptedVaultKey',
        'req.body.encryptedVaultData',
        'req.body.encryptedItemKey',
        'req.body.encryptedData',
        'req.body.encryptedName',
        'req.body.sealedVaultKey',
        'req.body.blob',
        'req.body.kekSalt',
        'req.body.items[*].encryptedData',
        'req.body.items[*].encryptedItemKey',
      ],
    },
  });

  type RateLimitConfig = Parameters<typeof rateLimit>[1];
  const rateLimitConfig: RateLimitConfig = {
    global: true,
    max: env.NODE_ENV === 'production' ? 100 : 1000,
    timeWindow: '1 minute',
  };

  let redisInstance: { quit: () => Promise<unknown> } | undefined;
  if (env.REDIS_URL) {
    const ioredis = await import('ioredis');
    const Redis = ioredis.Redis ?? ioredis.default;
    const redis = new Redis(env.REDIS_URL, { enableOfflineQueue: false });
    // Fail-closed: when Redis is unavailable, rate-limit commands throw AbortError
    // (enableOfflineQueue=false), which the error handler maps to 503.
    redis.on('error', (err) => app.log.error({ err }, 'Redis connection error'));
    rateLimitConfig.redis = redis;
    redisInstance = redis;
  }

  await app.register(cookie);
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: env.CORS_ORIGIN, credentials: true });
  await app.register(rateLimit, rateLimitConfig);
  await app.register(compress);
  await app.register(swagger, {
    openapi: { info: { title: 'BlindPass API', version: '0.0.1' } },
    transform: jsonSchemaTransform,
  });
  if (env.EXPOSE_DOCS) {
    await app.register(swaggerUi, { routePrefix: '/docs' });
  }
  await app.register(dbPlugin);
  await app.register(authPlugin);

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler(errorHandler);

  registerAdminRoutes(app);
  registerAuthRoutes(app);
  registerUserRoutes(app);
  registerVaultRoutes(app);

  app.addHook('onSend', (req, reply, _payload, done) => {
    reply.header('x-request-id', req.id);
    done();
  });

  app.get('/health', { config: { rateLimit: false } }, async (_, reply) => {
    try {
      await app.db.execute(sql`SELECT 1`);
      return reply.status(200).send({ status: 'ok', db: 'ok' });
    } catch {
      return reply.status(503).send({ status: 'degraded', db: 'error' });
    }
  });

  await app.listen({ port: env.PORT, host: '0.0.0.0' });

  const cleanupInterval = setInterval(
    () => {
      const now = new Date();
      void app.db
        .delete(sessions)
        .where(lt(sessions.expiresAt, now))
        .catch(() => {});
      void app.db
        .delete(pendingTotpEnrollments)
        .where(lt(pendingTotpEnrollments.expiresAt, now))
        .catch(() => {});
      void app.db
        .delete(recoveryTokens)
        .where(lt(recoveryTokens.expiresAt, now))
        .catch(() => {});
    },
    5 * 60 * 1000,
  );

  const shutdown = async () => {
    clearInterval(cleanupInterval);
    await redisInstance?.quit().catch(() => {});
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
}
