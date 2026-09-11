import { randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { cookies } from "next/headers";
import { z } from "zod";
import sharp from "sharp";
import {
  actor,
  AppError,
  assertOrigin,
  newDemo,
  rateLimit,
  hash,
  issueSession,
  setSession,
  passwordHash,
  verifyPassword,
  event,
} from "@/lib/security";
import { query, transaction } from "@/lib/db";
import { handle, jsonBody, bodyBytes } from "@/lib/http";
import {
  getListings,
  getListing,
  saveListing,
  searchListings,
  createBooking,
  getBookings,
  transitionBooking,
} from "@/lib/marketplace";
import { requirementsSchema, statuses } from "@/lib/domain";
import { assisted } from "@/lib/ai";
import { collectMetrics, metrics } from "@/lib/metrics";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
const uuid = z.string().uuid();
const known = new Set([
  "health",
  "metrics",
  "session",
  "auth",
  "listings",
  "search",
  "ai",
  "bookings",
  "events",
  "media",
  "insights",
]);
async function route(req: Request, ctx: Context) {
  const segments = (await ctx.params).path;
  const [resource, id] = segments;
  return handle(known.has(resource) ? resource : "other", req.method, async () => {
    if (!known.has(resource) || segments.length > 2) throw new AppError(404, "مسیر پیدا نشد.");
    if (resource === "health" && req.method === "GET") {
      try {
        await query("SELECT 1");
        return {
          status: "ok",
          database: "up",
          payments: "simulated",
          aiConfigured: !!process.env.AI_API_KEY && !!process.env.AI_MODEL,
        };
      } catch {
        throw new AppError(503, "پایگاه داده در دسترس نیست.");
      }
    }
    if (resource === "metrics" && req.method === "GET") {
      const expected = process.env.METRICS_TOKEN;
      const given = req.headers.get("authorization")?.replace(/^Bearer /, "");
      if (
        !expected ||
        !given ||
        Buffer.byteLength(expected) !== Buffer.byteLength(given) ||
        !timingSafeEqual(Buffer.from(expected), Buffer.from(given))
      )
        throw new AppError(401, "دسترسی مجاز نیست.");
      return new Response(await collectMetrics(), {
        headers: { "Content-Type": metrics.registry.contentType, "Cache-Control": "no-store" },
      });
    }
    if (req.method !== "GET") assertOrigin(req);
    if (resource === "session") {
      if (req.method === "GET") {
        try {
          const a = await actor();
          return {
            user: { id: a.userId, name: a.name, mode: a.mode, role: a.role },
            aiConfigured: !!process.env.AI_API_KEY && !!process.env.AI_MODEL,
          };
        } catch (e) {
          if (e instanceof AppError && e.status === 401)
            return { user: null, aiConfigured: !!process.env.AI_API_KEY && !!process.env.AI_MODEL };
          throw e;
        }
      }
      if (req.method !== "POST") throw new AppError(405, "این عملیات پشتیبانی نمی‌شود.");
      const b = z
        .object({
          action: z.enum(["demo", "switch", "logout"]),
          role: z.enum(["owner", "renter"]).optional(),
        })
        .parse(await jsonBody(req));
      if (b.action === "demo") {
        // Proxy replaces X-Real-IP; it is never used for authentication. A global limit bounds storage growth.
        await rateLimit(`demo:${hash(req.headers.get("x-real-ip") || "local")}`, 20, 3600);
        await rateLimit("demo:global", 300, 3600);
        const a = await newDemo();
        return { user: { id: a.userId, name: a.name, mode: a.mode, role: a.role } };
      }
      const a = await actor();
      if (b.action === "logout") {
        await query("DELETE FROM sessions WHERE token_hash=$1", [a.sessionHash]);
        (await cookies()).delete("tr_session");
        return { ok: true };
      }
      if (a.mode === "real" || !b.role) throw new AppError(403, "تغییر نقش فقط در دموی شخصی ممکن است.");
      await query(
        "UPDATE sessions SET user_id=(SELECT id FROM users WHERE workspace_id=$1 AND demo_role=$2) WHERE token_hash=$3",
        [a.workspaceId, b.role, a.sessionHash],
      );
      const next = await actor();
      return { user: { id: next.userId, name: next.name, mode: next.mode, role: next.role } };
    }
    if (resource === "auth" && req.method === "POST") {
      await rateLimit(`auth:${hash(req.headers.get("x-real-ip") || "local")}`, 15, 900);
      const b = z
        .object({
          action: z.enum(["login", "register"]),
          email: z
            .email()
            .max(200)
            .transform((s) => s.toLowerCase()),
          password: z.string().min(12, "رمز باید حداقل ۱۲ نویسه باشد.").max(128),
          name: z.string().trim().min(2).max(80).optional(),
        })
        .parse(await jsonBody(req));
      const token = await transaction(async (c) => {
        const workspace = "00000000-0000-4000-8000-000000000001";
        if (b.action === "register") {
          if (!b.name) throw new AppError(400, "نام را وارد کنید.");
          const userId = randomUUID();
          try {
            await c.query(
              "INSERT INTO users(id,workspace_id,name,email,password_hash) VALUES($1,$2,$3,$4,$5)",
              [userId, workspace, b.name, b.email, passwordHash(b.password)],
            );
          } catch (e) {
            if ((e as { code?: string }).code === "23505")
              throw new AppError(409, "با این ایمیل نمی‌توان حساب جدید ساخت؛ ورود را امتحان کنید.");
            throw e;
          }
          return issueSession(c, userId, workspace);
        }
        const u = (await c.query("SELECT id,password_hash FROM users WHERE email=$1", [b.email])).rows[0];
        if (!u || !verifyPassword(b.password, u.password_hash))
          throw new AppError(401, "ایمیل یا رمز نادرست است.");
        return issueSession(c, u.id, workspace);
      });
      await setSession(token);
      const a = await actor();
      return { user: { id: a.userId, name: a.name, mode: a.mode, role: a.role } };
    }
    const a = await actor();
    await rateLimit(`api:${a.sessionHash}`, 300, 60);
    if (resource === "listings") {
      if (req.method === "GET")
        return id
          ? { listing: await getListing(a, uuid.parse(id)) }
          : { listings: await getListings(a, new URL(req.url).searchParams.get("own") === "true") };
      if (req.method === "POST" || req.method === "PUT")
        return saveListing(a, await jsonBody(req), id ? uuid.parse(id) : undefined);
    }
    if (resource === "search" && req.method === "POST") return searchListings(a, await jsonBody(req));
    if (resource === "ai" && req.method === "POST") {
      const b = z
        .object({
          capability: z.enum(["search", "listing"]),
          text: z.string().trim().min(3).max(3000),
          requirements: requirementsSchema.optional(),
        })
        .parse(await jsonBody(req));
      if (b.capability === "search" && !b.requirements) throw new AppError(400, "فیلترهای فعلی لازم‌اند.");
      return assisted(a, b.capability, b.text, b.requirements);
    }
    if (resource === "bookings") {
      if (req.method === "GET") return { bookings: await getBookings(a) };
      if (req.method === "POST" && !id) {
        const b = z
          .object({
            listingId: uuid,
            startDate: z.string(),
            endDate: z.string(),
            requestKey: uuid,
            searchId: uuid.optional(),
          })
          .parse(await jsonBody(req));
        return { booking: await createBooking(a, b) };
      }
      if (req.method === "PATCH" && id) {
        const b = z
          .object({
            status: z.enum(statuses),
            report: z
              .object({
                condition: z.string().max(2000),
                accessories: z.array(z.string().max(100)).max(12),
                dataPrepared: z.boolean(),
              })
              .optional(),
          })
          .parse(await jsonBody(req));
        return { booking: await transitionBooking(a, uuid.parse(id), b.status, b.report) };
      }
    }
    if (resource === "events" && req.method === "POST") {
      const b = z
        .object({
          kind: z.enum(["listing_view", "comparison"]),
          key: uuid,
          entityId: uuid.optional(),
          searchId: uuid.optional(),
          listingIds: z.array(uuid).max(3).optional(),
        })
        .parse(await jsonBody(req));
      if (b.entityId) await getListing(a, b.entityId);
      for (const lid of b.listingIds || []) await getListing(a, lid);
      const validSearch =
        b.searchId &&
        (
          await query(
            "SELECT 1 FROM events WHERE workspace_id=$1 AND user_id=$2 AND kind='search' AND search_id=$3",
            [a.workspaceId, a.userId, b.searchId],
          )
        ).length
          ? b.searchId
          : null;
      await transaction((c) =>
        event(
          c,
          a,
          b.kind,
          `${b.kind}:${b.key}`,
          b.entityId || null,
          { count: b.listingIds?.length || 1 },
          validSearch,
        ),
      );
      return { ok: true };
    }
    if (resource === "media") {
      const dir = path.resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR || ".data/uploads");
      if (req.method === "GET" && id) {
        if (!/^[a-f0-9-]{36}$/.test(id)) throw new AppError(404, "عکس پیدا نشد.");
        const filename = `${id}.webp`;
        if (
          !(
            await query(
              "SELECT 1 FROM media m WHERE filename=$1 AND workspace_id=$2 AND (owner_id=$3 OR EXISTS(SELECT 1 FROM listings l WHERE l.workspace_id=m.workspace_id AND l.photos ? $4 AND (l.status='published' OR EXISTS(SELECT 1 FROM bookings b WHERE b.listing_id=l.id AND (b.owner_id=$3 OR b.renter_id=$3)))))",
              [filename, a.workspaceId, a.userId, `/api/media/${id}`],
            )
          ).length
        )
          throw new AppError(404, "عکس پیدا نشد.");
        try {
          return new Response(
            new Uint8Array(
              await readFile(
                /* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ dir, filename),
              ),
            ),
            {
              headers: {
                "Content-Type": "image/webp",
                "Cache-Control": "private, no-store, max-age=0",
                "CDN-Cache-Control": "no-store",
                Vary: "Cookie",
                "X-Content-Type-Options": "nosniff",
              },
            },
          );
        } catch {
          throw new AppError(404, "عکس در دسترس نیست.");
        }
      }
      if (req.method === "POST") {
        await rateLimit(`media:${a.workspaceId}`, 30, 3600);
        const bytes = await bodyBytes(req, 6 * 1024 * 1024);
        const form = await new Response(bytes, {
          headers: { "Content-Type": req.headers.get("content-type") || "" },
        }).formData();
        const file = form.get("file");
        if (
          !(file instanceof File) ||
          file.size > 5 * 1024 * 1024 ||
          file.size === 0 ||
          !["image/jpeg", "image/png", "image/webp"].includes(file.type)
        )
          throw new AppError(400, "فقط JPEG، PNG یا WebP تا ۵ مگابایت مجاز است.");
        let output: Buffer;
        try {
          output = await sharp(Buffer.from(await file.arrayBuffer()), {
            limitInputPixels: 20_000_000,
            animated: false,
          })
            .rotate()
            .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
            .webp({ quality: 82 })
            .toBuffer();
        } catch {
          throw new AppError(400, "فایل تصویر معتبر نیست یا ابعاد بسیار بزرگی دارد.");
        }
        const mid = randomUUID(),
          filename = `${mid}.webp`;
        await mkdir(dir, { recursive: true });
        await writeFile(path.join(dir, filename), output, { flag: "wx", mode: 0o640 });
        try {
          await query("INSERT INTO media(id,workspace_id,owner_id,filename,bytes) VALUES($1,$2,$3,$4,$5)", [
            mid,
            a.workspaceId,
            a.userId,
            filename,
            output.length,
          ]);
        } catch (e) {
          await unlink(path.join(dir, filename));
          throw e;
        }
        // Extensionless authenticated route avoids CDN static-file caching rules.
        return { url: `/api/media/${mid}` };
      }
    }
    if (resource === "insights" && req.method === "GET") {
      const events = await query(
        "SELECT kind,count(*)::int count FROM events WHERE workspace_id=$1 AND ($2::boolean OR user_id=$3) GROUP BY kind",
        [a.workspaceId, a.mode !== "real", a.userId],
      );
      const [sales] = await query(
        "SELECT count(*)::int requests,coalesce(sum(rental_total),0) requested,coalesce(sum(rental_total) FILTER(WHERE accepted_at IS NOT NULL),0) accepted,coalesce(sum(rental_total) FILTER(WHERE status='completed'),0) completed,coalesce(sum(commission_estimate) FILTER(WHERE status='completed'),0) commission FROM bookings WHERE workspace_id=$1 AND ($2::boolean OR owner_id=$3 OR renter_id=$3)",
        [a.workspaceId, a.mode !== "real", a.userId],
      );
      return { events, sales, mode: a.mode, payments: "simulated" };
    }
    throw new AppError(405, "این عملیات پشتیبانی نمی‌شود.");
  });
}
export const GET = route;
export const POST = route;
export const PUT = route;
export const PATCH = route;
