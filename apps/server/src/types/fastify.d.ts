import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '../db/schema.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: NodePgDatabase<typeof schema>;
  }
  interface FastifyRequest {
    userId: string;
    sessionId: string;
  }
}
