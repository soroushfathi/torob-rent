const fs = require("node:fs/promises");
const { Client } = require("pg");
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(842619)");
    await c.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())",
    );
    for (const name of (await fs.readdir("/app/db/migrations"))
      .filter((n) => n.endsWith(".sql"))
      .sort()) {
      if (
        (await c.query("SELECT 1 FROM schema_migrations WHERE name=$1", [name]))
          .rowCount
      )
        continue;
      await c.query(await fs.readFile(`/app/db/migrations/${name}`, "utf8"));
      await c.query("INSERT INTO schema_migrations(name) VALUES($1)", [name]);
      console.log(`Applied ${name}`);
    }
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    console.error("Migration failed:", e.code || e.name);
    process.exitCode = 1;
  } finally {
    await c.end();
  }
})().catch(() => {
  console.error("Database connection failed");
  process.exitCode = 1;
});
