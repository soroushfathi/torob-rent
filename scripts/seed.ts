import { randomUUID } from "node:crypto";
import { pool, transaction } from "../lib/db";
import { seedWorkspace } from "../lib/seed";
const id = process.env.SEED_WORKSPACE_ID || randomUUID();
transaction(async (c) => {
  if (!(await c.query("SELECT 1 FROM workspaces WHERE id=$1", [id])).rowCount)
    await seedWorkspace(c, id, "test");
  console.log(`Seeded isolated test workspace ${id}; no production or demo analytics fabricated.`);
}).finally(() => pool.end());
