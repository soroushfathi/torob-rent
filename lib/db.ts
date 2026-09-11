import { Pool, types, type PoolClient, type QueryResultRow } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
types.setTypeParser(20, Number);
types.setTypeParser(1082, (v) => v);
const globalDb = globalThis as unknown as { torobPool?: Pool; torobDbUrl?: string };
if (globalDb.torobPool && globalDb.torobDbUrl !== process.env.DATABASE_URL) {
  void globalDb.torobPool.end();
  globalDb.torobPool = undefined;
}
export const pool =
  globalDb.torobPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    statement_timeout: 10000,
  });
globalDb.torobPool = pool;
globalDb.torobDbUrl = process.env.DATABASE_URL;
pool.on("error", () => {
  /* No connection strings or query contents in logs. Health endpoint surfaces availability. */
});
export const db = drizzle(pool);
export async function query<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []) {
  return (await pool.query<T>(sql, params)).rows;
}
export async function transaction<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const value = await fn(c);
    await c.query("COMMIT");
    return value;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
