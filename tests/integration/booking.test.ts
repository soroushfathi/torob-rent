import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool, query, transaction } from "../../lib/db";
import { seedWorkspace } from "../../lib/seed";
import {
  createBooking,
  transitionBooking,
  saveListing,
  getListings,
  getListing,
  searchListings,
  expireRequests,
} from "../../lib/marketplace";
import { event, type Actor } from "../../lib/security";
import { defaultRequirements, addDays, type Listing } from "../../lib/domain";
test("PostgreSQL booking acceptance and owner/renter isolation", async (t) => {
  const workspaceId = randomUUID();
  const { ownerId, renterId } = await transaction((c) => seedWorkspace(c, workspaceId, "test"));
  const owner: Actor = {
      userId: ownerId,
      workspaceId,
      name: "test owner",
      mode: "test",
      role: "owner",
      sessionHash: randomUUID(),
    },
    renter: Actor = { ...owner, userId: renterId, role: "renter", sessionHash: randomUUID() };
  const outsider: Actor = { ...renter, userId: randomUUID() };
  await query("INSERT INTO users(id,workspace_id,name) VALUES($1,$2,'test outsider')", [
    outsider.userId,
    workspaceId,
  ]);
  const listings = await getListings(owner, true),
    l = listings.find((l) => l.chip === "M2 Pro")!;
  const r = defaultRequirements();
  const request = (listingId = l.id, key = randomUUID(), dates = r) =>
    createBooking(renter, { listingId, startDate: dates.startDate, endDate: dates.endDate, requestKey: key });
  await t.test("unauthorized edits, self rental and workspace enumeration blocked", async () => {
    await assert.rejects(() => saveListing(renter, l, l.id), /مالک/);
    await assert.rejects(
      () =>
        createBooking(owner, {
          listingId: l.id,
          startDate: r.startDate,
          endDate: r.endDate,
          requestKey: randomUUID(),
        }),
      /خودتان/,
    );
    await assert.rejects(() => getListing({ ...renter, workspaceId: randomUUID() }, l.id), /پیدا نشد/);
  });
  let bookingId: string;
  await t.test("parallel duplicate requests and events remain one durable record", async () => {
    const key = randomUUID();
    const [a, b] = await Promise.all([request(l.id, key), request(l.id, key)]);
    assert.equal(a.id, b.id);
    bookingId = a.id;
    const counts = await query(
      "SELECT count(*)::int n FROM events WHERE workspace_id=$1 AND entity_id=$2 AND kind='booking_requested'",
      [workspaceId, a.id],
    );
    assert.equal(counts[0].n, 1);
    await Promise.all([
      transaction((c) => event(c, renter, "listing_view", "same-view", l.id)),
      transaction((c) => event(c, renter, "listing_view", "same-view", l.id)),
    ]);
    assert.equal(
      (
        await query("SELECT count(*)::int n FROM events WHERE workspace_id=$1 AND event_key='same-view'", [
          workspaceId,
        ])
      )[0].n,
      1,
    );
    await assert.rejects(() => request(listings.find((x) => x.id !== l.id)!.id, key), /قبلاً/);
  });
  await t.test("invalid transitions and unauthorized acceptance fail", async () => {
    await assert.rejects(() => transitionBooking(renter, bookingId, "accepted"), /مجاز/);
    await assert.rejects(() => transitionBooking(outsider, bookingId, "cancelled"), /اجازه/);
    await assert.rejects(() => transitionBooking(owner, bookingId, "completed"), /مجاز/);
  });
  await t.test("concurrent acceptance allows exactly one overlap", async () => {
    const second = await request();
    const result = await Promise.allSettled([
      transitionBooking(owner, bookingId, "accepted"),
      transitionBooking(owner, second.id, "accepted"),
    ]);
    assert.equal(result.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(result.filter((r) => r.status === "rejected").length, 1);
    const accepted = result.find((r) => r.status === "fulfilled") as PromiseFulfilledResult<
      Record<string, unknown>
    >;
    bookingId = accepted.value.id as string;
    assert.equal(
      (
        await query("SELECT count(*)::int n FROM bookings WHERE listing_id=$1 AND status='accepted'", [l.id])
      )[0].n,
      1,
    );
    await assert.rejects(() => request(), /قبلاً رزرو/);
    assert.ok(!(await searchListings(renter, r)).listings.some((x) => x.id === l.id));
  });
  await t.test("accepted snapshot unaffected by listing edits and retry doesn't double count", async () => {
    const before = (await query("SELECT * FROM bookings WHERE id=$1", [bookingId]))[0];
    await saveListing(owner, { ...l, dailyPrice: 990000, deposit: 90000000, guarantee: "new terms" }, l.id);
    const after = (await query("SELECT * FROM bookings WHERE id=$1", [bookingId]))[0];
    assert.equal(after.rental_total, 2550000);
    assert.equal(after.deposit, 35000000);
    assert.deepEqual(after.terms, before.terms);
    await transitionBooking(owner, bookingId, "accepted");
    assert.equal(
      (
        await query("SELECT count(*)::int n FROM events WHERE entity_id=$1 AND kind='booking_accepted'", [
          bookingId,
        ])
      )[0].n,
      1,
    );
  });
  await t.test("handoff and return require condition/accessory/data reports", async () => {
    await assert.rejects(() => transitionBooking(owner, bookingId, "handed_over"), /گزارش/);
    const report = {
      condition: "Synthetic device and accessories inspected",
      accessories: l.accessories,
      dataPrepared: true,
    };
    await transitionBooking(owner, bookingId, "handed_over", report);
    await assert.rejects(() => transitionBooking(renter, bookingId, "completed", report), /مجاز/);
    const done = await transitionBooking(owner, bookingId, "completed", report);
    assert.equal(done.status, "completed");
    assert.equal(done.commission_estimate, 127500);
    assert.equal(done.payment_mode, "simulated");
  });
  await t.test("adjacent interval is allowed, paused and blocked listings cannot be accepted", async () => {
    const adjacent = { ...r, startDate: r.endDate, endDate: addDays(r.endDate, 3) };
    const b = await request(l.id, randomUUID(), adjacent);
    await transitionBooking(owner, b.id, "accepted");
    const next = listings.find((x) => x.chip === "M1 Pro")!;
    const pending = await request(next.id);
    await saveListing(owner, { ...next, status: "paused" }, next.id);
    await assert.rejects(() => transitionBooking(owner, pending.id, "accepted"), /دسترس/);
  });
  await t.test("expiry is durable and cancelled requests release availability", async () => {
    const free = listings.find((x) => x.chip === "M1") as Listing;
    const b = await request(free.id);
    await query("UPDATE bookings SET expires_at=now()-interval '1 minute' WHERE id=$1", [b.id]);
    await transaction((c) => expireRequests(c, workspaceId));
    assert.equal((await query("SELECT status FROM bookings WHERE id=$1", [b.id]))[0].status, "expired");
    await assert.rejects(() => transitionBooking(owner, b.id, "accepted"), /مجاز/);
    const next = await request(free.id);
    await transitionBooking(renter, next.id, "cancelled");
    assert.ok((await searchListings(renter, r)).listings.some((l) => l.id === free.id));
  });
  console.log(`Integration evidence workspace: ${workspaceId} (mode=test)`);
});
test.after(() => pool.end());
