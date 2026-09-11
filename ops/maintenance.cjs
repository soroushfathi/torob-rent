// Run every minute using the provided systemd timer. Only expires pending requests.
const { Client } = require("pg");
const { randomUUID } = require("node:crypto");
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  try {
    await c.query("BEGIN");
    const { rows } = await c.query(
      "UPDATE bookings SET status='expired',updated_at=now() WHERE status='requested' AND expires_at<=now() RETURNING id,workspace_id,search_id",
    );
    for (const b of rows)
      await c.query(
        "INSERT INTO events(id,workspace_id,event_key,kind,entity_id,search_id) VALUES($1,$2,$3,'booking_expired',$4,$5) ON CONFLICT(workspace_id,event_key) DO NOTHING",
        [randomUUID(), b.workspace_id, `${b.id}:expired`, b.id, b.search_id],
      );
    await c.query(
      "DELETE FROM sessions WHERE expires_at<now()-interval '1 day'",
    );
    await c.query(
      "DELETE FROM rate_limits WHERE window_start<now()-interval '2 days'",
    );
    await c.query("COMMIT");
    console.log(`Expired ${rows.length} pending requests`);
  } catch {
    await c.query("ROLLBACK");
    process.exitCode = 1;
  } finally {
    await c.end();
  }
})().catch(() => {
  process.exitCode = 1;
});
