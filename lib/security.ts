import { randomBytes, randomUUID, createHash, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { PoolClient } from "pg";
import { query, transaction } from "./db";
import { seedWorkspace } from "./seed";
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export type Actor = {
  userId: string;
  workspaceId: string;
  name: string;
  mode: "demo" | "real" | "test";
  role: "owner" | "renter" | null;
  sessionHash: string;
};
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export async function actor(): Promise<Actor> {
  const token = (await cookies()).get("tr_session")?.value;
  if (!token) throw new AppError(401, "برای ادامه وارد شوید یا دموی شخصی را شروع کنید.");
  const [s] = await query(
    `SELECT s.user_id,s.workspace_id,u.name,u.demo_role,w.mode FROM sessions s JOIN users u ON u.id=s.user_id JOIN workspaces w ON w.id=s.workspace_id WHERE s.token_hash=$1 AND s.expires_at>now()`,
    [hash(token)],
  );
  if (!s) throw new AppError(401, "نشست شما پایان یافته است. دوباره وارد شوید.");
  return {
    userId: s.user_id,
    workspaceId: s.workspace_id,
    name: s.name,
    role: s.demo_role,
    mode: s.mode,
    sessionHash: hash(token),
  };
}
export async function issueSession(c: PoolClient, userId: string, workspaceId: string) {
  const token = randomBytes(32).toString("hex");
  await c.query(
    "INSERT INTO sessions(token_hash,user_id,workspace_id,expires_at) VALUES($1,$2,$3,now()+interval '7 days')",
    [hash(token), userId, workspaceId],
  );
  return token;
}
export async function setSession(token: string) {
  (await cookies()).set("tr_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.APP_ORIGIN?.startsWith("https://") ?? false,
    path: "/",
    maxAge: 7 * 86400,
  });
}
export async function newDemo() {
  if (process.env.ALLOW_DEMO === "false") throw new AppError(403, "حالت دمو غیرفعال است.");
  const token = await transaction(async (c) => {
    const workspaceId = randomUUID();
    const { renterId } = await seedWorkspace(c, workspaceId);
    return issueSession(c, renterId, workspaceId);
  });
  await setSession(token);
  return actor();
}
export function assertOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const allowed = process.env.APP_ORIGIN || "http://localhost:3000";
  if (!origin || origin !== allowed) throw new AppError(403, "مبدأ درخواست معتبر نیست.");
  if (req.headers.get("sec-fetch-site") === "cross-site")
    throw new AppError(403, "درخواست بین‌سایتی مجاز نیست.");
}
export async function rateLimit(key: string, limit: number, seconds: number) {
  const [r] = await query(
    `INSERT INTO rate_limits(key,window_start,count) VALUES($1,now(),1) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.window_start<now()-make_interval(secs=>$2) THEN 1 ELSE rate_limits.count+1 END,window_start=CASE WHEN rate_limits.window_start<now()-make_interval(secs=>$2) THEN now() ELSE rate_limits.window_start END RETURNING count`,
    [key, seconds],
  );
  if (r.count > limit) throw new AppError(429, "تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کنید.");
}
export function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function verifyPassword(password: string, encoded: string) {
  const [salt, key] = encoded.split(":");
  if (!salt || !key) return false;
  const expected = Buffer.from(key, "hex"),
    actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export async function event(
  c: PoolClient,
  a: Actor,
  kind: string,
  key: string,
  entityId: string | null = null,
  payload: Record<string, unknown> = {},
  searchId: string | null = null,
) {
  await c.query(
    "INSERT INTO events(id,workspace_id,user_id,session_id,kind,event_key,entity_id,payload,search_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(workspace_id,event_key) DO NOTHING",
    [
      randomUUID(),
      a.workspaceId,
      a.userId,
      a.sessionHash,
      kind,
      key,
      entityId,
      JSON.stringify(payload),
      searchId,
    ],
  );
}
