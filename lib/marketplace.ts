import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import type { PoolClient } from "pg";
import { db, query, transaction } from "./db";
import { listings as listingTable } from "../db/schema";
import { type Actor, AppError, event } from "./security";
import { listingColumns, listingValues } from "./seed";
import {
  listingSchema,
  requirementsSchema,
  matches,
  suitability,
  quote,
  canTransition,
  todayTehran,
  type Listing,
  type ListingInput,
  type BookingStatus,
  type Requirements,
} from "./domain";

export async function getListings(a: Actor, own = false): Promise<Listing[]> {
  const rows = await db
    .select()
    .from(listingTable)
    .where(
      own
        ? and(eq(listingTable.workspaceId, a.workspaceId), eq(listingTable.ownerId, a.userId))
        : and(eq(listingTable.workspaceId, a.workspaceId), eq(listingTable.status, "published")),
    );
  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    ownerName: r.ownerId === a.userId ? a.name : a.mode === "real" ? "مالک آگهی" : "مالک نمونه",
  })) as Listing[];
}
export async function getListing(a: Actor, id: string) {
  const [r] = await db
    .select()
    .from(listingTable)
    .where(and(eq(listingTable.id, id), eq(listingTable.workspaceId, a.workspaceId)));
  if (!r || (r.status !== "published" && r.ownerId !== a.userId))
    throw new AppError(404, "آگهی پیدا نشد یا در دسترس نیست.");
  return {
    ...r,
    createdAt: r.createdAt.toISOString(),
    ownerName: a.mode === "real" ? "مالک آگهی" : "مالک نمونه",
  } as Listing;
}
export async function searchListings(a: Actor, input: unknown, searchId = randomUUID()) {
  const r = requirementsSchema.parse(input);
  if (r.startDate < todayTehran()) throw new AppError(400, "تاریخ شروع نمی‌تواند در گذشته باشد.");
  const all = await getListings(a);
  const reserved = await query(
    "SELECT listing_id FROM bookings WHERE workspace_id=$1 AND status IN ('accepted','handed_over','completed') AND start_date<$3 AND end_date>$2",
    [a.workspaceId, r.startDate, r.endDate],
  );
  const busy = new Set(reserved.map((b) => b.listing_id));
  const days = quote(1000, 0, r.startDate, r.endDate).days;
  const eligible = all
    .filter((l) => matches(l, r) && !busy.has(l.id))
    .sort((x, y) => x.dailyPrice * days + x.deposit / 100 - (y.dailyPrice * days + y.deposit / 100));
  // Sorting is disclosed as combined rental cost and deposit burden; suitability is an eligibility rule.
  await transaction((c) =>
    event(
      c,
      a,
      "search",
      `search:${searchId}`,
      null,
      { resultCount: eligible.length, zero: eligible.length === 0 },
      searchId,
    ),
  );
  return {
    searchId,
    requirements: r,
    listings: eligible.map((l) => ({
      ...l,
      quote: quote(l.dailyPrice, l.deposit, r.startDate, r.endDate),
      reasons: suitability(l, r).reasons,
    })),
    total: eligible.length,
  };
}
async function validatePhotos(c: PoolClient, a: Actor, l: ListingInput) {
  for (const p of l.photos) {
    if (a.mode !== "real" && /^\/images\/(macbook-pro|macbook-air|macbook-desk)\.jpg$/.test(p)) continue;
    if (!/^\/api\/media\/[a-f0-9-]{36}$/.test(p))
      throw new AppError(400, "فقط عکس‌های بارگذاری‌شدهٔ خودتان قابل استفاده‌اند.");
    if (
      !(
        await c.query("SELECT 1 FROM media WHERE filename=$1 AND owner_id=$2 AND workspace_id=$3", [
          `${p.split("/").pop()}.webp`,
          a.userId,
          a.workspaceId,
        ])
      ).rowCount
    )
      throw new AppError(403, "این عکس متعلق به حساب شما نیست.");
  }
}
export async function saveListing(a: Actor, input: unknown, id?: string) {
  const l = listingSchema.parse(input);
  return transaction(async (c) => {
    await validatePhotos(c, a, l);
    let previous: string | null = null;
    if (id) {
      const row = (
        await c.query("SELECT owner_id,status FROM listings WHERE id=$1 AND workspace_id=$2 FOR UPDATE", [
          id,
          a.workspaceId,
        ])
      ).rows[0];
      if (!row || row.owner_id !== a.userId) throw new AppError(403, "فقط مالک می‌تواند آگهی را ویرایش کند.");
      previous = row.status;
      await c.query(
        `UPDATE listings SET ${listingColumns.map((col, i) => `${col}=$${i + 1}`).join(",")},updated_at=now() WHERE id=$${listingColumns.length + 1}`,
        [...listingValues(l), id],
      );
    } else {
      id = randomUUID();
      await c.query(
        `INSERT INTO listings(id,workspace_id,owner_id,synthetic,${listingColumns.join(",")}) VALUES($1,$2,$3,$4,${listingColumns.map((_, i) => `$${i + 5}`).join(",")})`,
        [id, a.workspaceId, a.userId, a.mode !== "real", ...listingValues(l)],
      );
    }
    if (l.status === "published" && previous !== "published")
      await event(c, a, "owner_activated", `activation:${a.userId}`, id);
    return { id };
  });
}
export async function expireRequests(c: PoolClient, workspaceId?: string) {
  const rows = (
    await c.query(
      `UPDATE bookings SET status='expired',updated_at=now() WHERE status='requested' AND expires_at<=now() ${workspaceId ? "AND workspace_id=$1" : ""} RETURNING *`,
      workspaceId ? [workspaceId] : [],
    )
  ).rows;
  for (const b of rows)
    await c.query(
      "INSERT INTO events(id,workspace_id,event_key,kind,entity_id,search_id) VALUES($1,$2,$3,'booking_expired',$4,$5) ON CONFLICT(workspace_id,event_key) DO NOTHING",
      [randomUUID(), b.workspace_id, `${b.id}:expired`, b.id, b.search_id],
    );
}
function rowListing(row: Record<string, unknown>): Listing {
  const camel: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) camel[k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = v;
  return camel as unknown as Listing;
}
export async function createBooking(
  a: Actor,
  input: { listingId: string; startDate: string; endDate: string; requestKey: string; searchId?: string },
) {
  const r = requirementsSchema.parse({ ...input, budget: null, maxDeposit: null, minRam: null });
  if (r.startDate <= todayTehran()) throw new AppError(400, "رزرو از فردا ممکن است؛ تحویل ساعت ۱۲ ظهر است.");
  return transaction(async (c) => {
    // Serialize retries before inspecting existing booking. Database exclusion handles concurrent acceptance.
    await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `${a.workspaceId}:${a.userId}:${input.requestKey}`,
    ]);
    const existing = (
      await c.query("SELECT * FROM bookings WHERE workspace_id=$1 AND renter_id=$2 AND request_key=$3", [
        a.workspaceId,
        a.userId,
        input.requestKey,
      ])
    ).rows[0];
    if (existing) {
      if (
        existing.listing_id !== input.listingId ||
        existing.start_date !== r.startDate ||
        existing.end_date !== r.endDate
      )
        throw new AppError(409, "شناسهٔ درخواست قبلاً برای رزرو دیگری استفاده شده است.");
      return existing;
    }
    const row = (
      await c.query("SELECT * FROM listings WHERE id=$1 AND workspace_id=$2 FOR SHARE", [
        input.listingId,
        a.workspaceId,
      ])
    ).rows[0];
    if (!row) throw new AppError(404, "آگهی پیدا نشد.");
    const l = rowListing(row);
    if (l.ownerId === a.userId) throw new AppError(403, "نمی‌توانید دستگاه خودتان را اجاره کنید.");
    if (!matches(l, r)) throw new AppError(409, "دستگاه در این بازه یا مدت قابل اجاره نیست.");
    if (
      (
        await c.query(
          "SELECT 1 FROM bookings WHERE listing_id=$1 AND status IN ('accepted','handed_over','completed') AND start_date<$3 AND end_date>$2",
          [l.id, r.startDate, r.endDate],
        )
      ).rowCount
    )
      throw new AppError(409, "این بازه قبلاً رزرو شده است.");
    let searchId: string | null = null;
    if (
      input.searchId &&
      (
        await c.query(
          "SELECT 1 FROM events WHERE workspace_id=$1 AND user_id=$2 AND kind='search' AND search_id=$3",
          [a.workspaceId, a.userId, input.searchId],
        )
      ).rowCount
    )
      searchId = input.searchId;
    const q = quote(l.dailyPrice, l.deposit, r.startDate, r.endDate, Number(process.env.DEMO_FEE_BPS || 500));
    const id = randomUUID();
    const b = (
      await c.query(
        `INSERT INTO bookings(id,workspace_id,listing_id,renter_id,owner_id,start_date,end_date,request_key,quote,terms,rental_total,deposit,commission_estimate,expires_at,search_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,LEAST(now()+interval '24 hours',($6::date+time '12:00') AT TIME ZONE 'Asia/Tehran'),$14) RETURNING *`,
        [
          id,
          a.workspaceId,
          l.id,
          a.userId,
          l.ownerId,
          r.startDate,
          r.endDate,
          input.requestKey,
          JSON.stringify(q),
          JSON.stringify({
            title: l.title,
            model: l.model,
            chip: l.chip,
            ram: l.ram,
            storage: l.storage,
            accessories: l.accessories,
            guarantee: l.guarantee,
            condition: l.condition,
            neighborhood: l.neighborhood,
            pickupTime: "12:00 Asia/Tehran",
            returnTime: "12:00 Asia/Tehran",
            minDays: l.minDays,
          }),
          q.rental,
          q.deposit,
          q.estimatedCommission,
          searchId,
        ],
      )
    ).rows[0];
    await event(
      c,
      a,
      "booking_requested",
      `${id}:requested`,
      id,
      { rental: q.rental, deposit: q.deposit },
      searchId,
    );
    return b;
  });
}
export async function transitionBooking(
  a: Actor,
  id: string,
  to: BookingStatus,
  report?: { condition: string; accessories: string[]; dataPrepared: boolean },
) {
  return transaction(async (c) => {
    await expireRequests(c, a.workspaceId);
    const b = (
      await c.query("SELECT * FROM bookings WHERE id=$1 AND workspace_id=$2 FOR UPDATE", [id, a.workspaceId])
    ).rows[0];
    if (!b) throw new AppError(404, "درخواست پیدا نشد.");
    const role = b.owner_id === a.userId ? "owner" : b.renter_id === a.userId ? "renter" : null;
    if (!role) throw new AppError(403, "اجازهٔ تغییر این درخواست را ندارید.");
    // Repeating a successful transition is idempotent, but still requires its authorized actor.
    if (b.status === to) {
      if (
        (to === "accepted" || to === "handed_over" || to === "completed" || to === "rejected") &&
        role !== "owner"
      )
        throw new AppError(403, "این عملیات مخصوص مالک است.");
      return b;
    }
    if (!canTransition(b.status, to, role)) throw new AppError(409, "این تغییر وضعیت مجاز نیست.");
    if (to === "cancelled" && b.status === "accepted" && b.start_date <= todayTehran())
      throw new AppError(409, "لغو پس از روز شروع ممکن نیست؛ ابتدا وضعیت تحویل را تعیین کنید.");
    if (to === "accepted") {
      const row = (await c.query("SELECT * FROM listings WHERE id=$1 FOR SHARE", [b.listing_id])).rows[0];
      const l = rowListing(row);
      const r: Requirements = {
        startDate: b.start_date,
        endDate: b.end_date,
        budget: null,
        maxDeposit: null,
        minRam: null,
        neighborhood: "",
        chip: "",
        software: "unknown",
        workload: "unknown",
      };
      if (!matches(l, r))
        throw new AppError(409, "دسترس‌پذیری آگهی تغییر کرده است؛ این درخواست قابل پذیرش نیست.");
    }
    if (to === "handed_over" || to === "completed") {
      if (!report?.dataPrepared || report.condition.trim().length < 4)
        throw new AppError(400, "گزارش وضعیت و تأیید آماده‌سازی اطلاعات را کامل کنید.");
      const expected = b.terms.accessories as string[];
      if (!expected.every((item) => report.accessories.includes(item)))
        throw new AppError(400, "تمام لوازم را تطبیق دهید؛ هر مغایرت را در گزارش بنویسید.");
      if (a.mode === "real" && to === "handed_over" && b.start_date > todayTehran())
        throw new AppError(409, "تحویل پیش از روز شروع مجاز نیست.");
    }
    let updated: typeof b;
    try {
      updated = (
        await c.query(
          `UPDATE bookings SET status=$2,updated_at=now(),responded_at=CASE WHEN $2 IN ('accepted','rejected') THEN now() ELSE responded_at END,accepted_at=CASE WHEN $2='accepted' THEN now() ELSE accepted_at END,completed_at=CASE WHEN $2='completed' THEN now() ELSE completed_at END,handoff=CASE WHEN $2='handed_over' THEN $3::jsonb ELSE handoff END,return_report=CASE WHEN $2='completed' THEN $3::jsonb ELSE return_report END WHERE id=$1 RETURNING *`,
          [id, to, report ? JSON.stringify({ ...report, by: role, simulated: a.mode !== "real" }) : null],
        )
      ).rows[0];
    } catch (e) {
      if ((e as { code?: string }).code === "23P01")
        throw new AppError(409, "این بازه هم‌زمان توسط درخواست دیگری رزرو شد. تاریخ دیگری انتخاب کنید.");
      throw e;
    }
    await event(c, a, `booking_${to}`, `${id}:${to}`, id, { rental: b.rental_total }, b.search_id);
    return updated;
  });
}
export async function getBookings(a: Actor) {
  await transaction((c) => expireRequests(c, a.workspaceId));
  return query(
    "SELECT b.*,l.title,l.photos FROM bookings b JOIN listings l ON l.id=b.listing_id WHERE b.workspace_id=$1 AND (b.owner_id=$2 OR b.renter_id=$2) ORDER BY b.created_at DESC",
    [a.workspaceId, a.userId],
  );
}
