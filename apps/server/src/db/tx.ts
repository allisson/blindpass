import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from './schema.js';

// Branded type that signals "this Db handle is inside a transaction." The brand
// is type-only; the runtime value is the same Drizzle handle. Routes are the
// single producer (via `asTx` inside `app.db.transaction(...)`); write-path
// services are the consumers. Convention promoted to type obligation, mirroring
// `ProofOfSession` in `auth/session/index.ts`.
declare const txBrand: unique symbol;
export type TxDb = NodePgDatabase<typeof schema> & { readonly [txBrand]: true };

export const asTx = (db: NodePgDatabase<typeof schema>): TxDb => db as TxDb;
