import EmbeddedPostgres from "embedded-postgres";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { randomBytes } from "node:crypto";
async function main() {
  await mkdir(".local", { recursive: true });
  let password: string;
  try {
    password = (await readFile(".local/db-password", "utf8")).trim();
  } catch {
    password = randomBytes(24).toString("hex");
    await writeFile(".local/db-password", password, { mode: 0o600 });
  }
  const pg = new EmbeddedPostgres({
    databaseDir: ".local/postgres",
    port: 55439,
    user: "torob",
    password,
    persistent: true,
    authMethod: "scram-sha-256",
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-h", "127.0.0.1"],
    onLog: () => {},
    onError: () => {},
  });
  try {
    await access(".local/postgres/PG_VERSION");
  } catch {
    await pg.initialise();
  }
  await pg.start();
  const client = pg.getPgClient();
  await client.connect();
  if (!(await client.query("SELECT 1 FROM pg_database WHERE datname='torob_rent_utf8'")).rowCount)
    await client.query(
      "CREATE DATABASE torob_rent_utf8 WITH TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'",
    );
  await client.end();
  try {
    await access(".env.local");
  } catch {
    await writeFile(
      ".env.local",
      `DATABASE_URL=postgresql://torob:${password}@127.0.0.1:55439/torob_rent_utf8\nAPP_ORIGIN=http://localhost:14567\nUPLOAD_DIR=.data/uploads\nMETRICS_TOKEN=${randomBytes(32).toString("hex")}\nALLOW_DEMO=true\nDEMO_FEE_BPS=500\nPAYMENTS_ENABLED=false\n`,
      { mode: 0o600 },
    );
  }
  console.log(
    "Local persistent PostgreSQL ready on 127.0.0.1:55439. Credentials saved in ignored .env.local.",
  );
  process.on("SIGINT", () => {
    pg.stop().then(() => process.exit(0));
  });
  process.on("SIGTERM", () => {
    pg.stop().then(() => process.exit(0));
  });
  setInterval(() => {}, 60000);
}
main().catch((e) => {
  console.error("Local PostgreSQL failed:", e instanceof Error ? e.message : "unknown");
  process.exitCode = 1;
});
