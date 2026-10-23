import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

declare global {
  var _postgresPool: InstanceType<typeof Pool> | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    if (process.env.SQL_HOST && process.env.SQL_USER) {
      global._postgresPool = new Pool({
        host: process.env.SQL_HOST,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DB_NAME,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 15000,
      });
    } else if (process.env.DATABASE_URL) {
      global._postgresPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 15000,
      });
    } else {
      console.warn('[AI Studio] Database not connected — using mock pool');
      global._postgresPool = {
        query: async () => ({ rows: [] }),
        connect: async () => ({ query: async () => ({ rows: [] }), release: () => {} }),
        on: () => {},
      } as any;
    }

    const p = global._postgresPool;
    if (p && typeof p.on === "function") {
      p.on('error', (err: any) => {
        // Handle idle client terminations cleanly so they don't trigger unhandled process exceptions
        if (
          err?.message?.includes('Connection terminated unexpectedly') ||
          err?.message?.includes('closed unexpectedly') ||
          err?.code === '57P01'
        ) {
          console.warn('[AI Studio] Idle SQL client disconnected cleanly:', err.message || err);
        } else {
          console.error('[AI Studio] SQL pool client error:', err);
        }
      });
    }
  }
  return global._postgresPool!;
};

const pool = createPool();

let db: any;
try {
  if (process.env.SQL_HOST || process.env.DATABASE_URL) {
    db = drizzle(pool as any, { schema });
  } else {
    throw new Error("No database credentials");
  }
} catch {
  const noOp = { 
    findMany: async () => [], 
    findFirst: async () => null,
    findUnique: async () => null, 
    create: async (d: any) => d?.data ?? {},
    update: async (d: any) => d?.data ?? {}, 
    delete: async () => ({}) 
  };
  db = new Proxy({}, {
    get: (_, prop) => prop === 'query'
      ? new Proxy({}, { get: () => noOp }) : async () => [],
  }) as any;
}

export { db, pool };
export * from "./schema";
