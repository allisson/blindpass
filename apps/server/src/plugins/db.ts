import fp from 'fastify-plugin';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../db/schema.js';
import { env } from '../env.js';

export const dbPlugin = fp(async (app) => {
  const pool = new Pool({ connectionString: env.DATABASE_URL, max: env.DB_POOL_MAX });
  app.decorate('db', drizzle(pool, { schema }));
  app.addHook('onClose', () => pool.end());
});
