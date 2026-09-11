import { readFile, readdir } from "node:fs/promises";
import { pool, transaction } from "../lib/db";
async function main() {
  await transaction(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(842619)");
    await c.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    for (const name of (await readdir("db/migrations")).filter((n) => n.endsWith(".sql")).sort()) {
      if ((await c.query("SELECT 1 FROM schema_migrations WHERE name=$1", [name])).rowCount) continue;
      await c.query(await readFile(`db/migrations/${name}`, "utf8"));
      await c.query("INSERT INTO schema_migrations(name) VALUES($1)", [name]);
      console.log(`Applied ${name}`);
    }
  });
  await pool.end();
}
main().catch(() => {
  console.error(
    "Migration failed. Check database connectivity and migration compatibility; no secrets were logged.",
  );
  process.exitCode = 1;
  pool.end();
});
