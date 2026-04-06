import { neon, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { drizzle as drizzlePool } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// HTTP driver — default for single-statement reads/writes (cheap, serverless-friendly).
const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql, { schema });

// Pool driver — used for multi-statement TRANSACTIONS (sync endpoint).
// The neon-http driver cannot run `db.transaction()` — it throws at runtime.
// Lazy-initialized so HTTP-only routes don't pay the WebSocket startup cost.
let _dbPool: ReturnType<typeof drizzlePool> | null = null;
export function getDbPool() {
  if (!_dbPool) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    _dbPool = drizzlePool(pool, { schema });
  }
  return _dbPool;
}
