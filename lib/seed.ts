import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { addDays, todayTehran, type ListingInput } from "./domain";
export function demoInventory(): ListingInput[] {
  const today = todayTehran();
  const specs: [string, string, number | null, number | null, string, number, number, number][] = [
    ["MacBook Pro 14", "M2 Pro", 16, 512, "یوسف‌آباد", 850000, 35000000, 1],
    ["MacBook Air 13", "M1", 8, 256, "ونک", 390000, 20000000, 2],
    ["MacBook Pro 16", "M3 Pro", 36, 1024, "سعادت‌آباد", 1450000, 65000000, 2],
    ["MacBook Pro 14", "M1 Pro", 16, 512, "صادقیه", 720000, 30000000, 1],
    ["MacBook Air 15", "M2", 16, 512, "تهرانپارس", 590000, 28000000, 1],
    ["MacBook Pro 16", "M1 Max", 32, 1024, "پونک", 1150000, 50000000, 3],
    ["MacBook Pro 13", "Intel", 16, 512, "انقلاب", 330000, 18000000, 1],
    ["MacBook Pro 14", "M3", 8, 512, "جردن", 680000, 45000000, 2],
    ["MacBook Air 13", "M2", null, 256, "نارمک", 450000, 22000000, 1],
    ["MacBook Pro 16", "M2 Max", 64, 2048, "تجریش", 1950000, 90000000, 3],
    ["MacBook Pro 14", "M4 Pro", 24, 512, "شهرک غرب", 1300000, 55000000, 2],
    ["MacBook Air 13", "M3", 16, 512, "پاسداران", 650000, 32000000, 1],
  ];
  return specs.map(([model, chip, ram, storage, neighborhood, dailyPrice, deposit, minDays], i) => ({
    title: `${model} · ${chip}`,
    model,
    chip,
    ram,
    storage,
    neighborhood,
    dailyPrice,
    deposit,
    minDays,
    description:
      i === 8
        ? "این آگهی نمونه عمداً مشخصات رم نامشخص دارد. قبل از انتخاب از مالک سؤال کنید."
        : "آگهی ساختگی برای تجربهٔ اجاره در تهران. مشخصات و مبالغ فرضی‌اند و عکس صرفاً نمونهٔ ظاهری است. نصب نرم‌افزار و فضای خالی با توافق مالک بررسی می‌شود.",
    condition: i === 6 ? "fair" : "good",
    accessories: i % 3 === 0 ? ["شارژر اصلی", "کیف محافظ", "تبدیل USB-C"] : ["شارژر", "کیف محافظ"],
    guarantee:
      i % 3 === 0
        ? "هماهنگی قرارداد کتبی در زمان تحویل؛ در این دمو هیچ مدرک یا ضمانتی دریافت نمی‌شود."
        : "شرایط ضمانت نیازمند توافق مالک و اجاره‌کننده است؛ در دمو چیزی دریافت نمی‌شود.",
    availableFrom: today,
    availableTo: addDays(today, 90),
    blocked: i === 2 || i === 7 ? [{ start: addDays(today, 1), end: addDays(today, 6) }] : [],
    photos: [`/images/${i % 3 === 0 ? "macbook-pro" : i % 3 === 1 ? "macbook-air" : "macbook-desk"}.jpg`],
    status: "published",
  }));
}
export const listingColumns = [
  "title",
  "model",
  "chip",
  "ram",
  "storage",
  "description",
  "condition",
  "accessories",
  "neighborhood",
  "daily_price",
  "deposit",
  "min_days",
  "guarantee",
  "available_from",
  "available_to",
  "blocked",
  "photos",
  "status",
];
export function listingValues(l: ListingInput) {
  return [
    l.title,
    l.model,
    l.chip,
    l.ram,
    l.storage,
    l.description,
    l.condition,
    JSON.stringify(l.accessories),
    l.neighborhood,
    l.dailyPrice,
    l.deposit,
    l.minDays,
    l.guarantee,
    l.availableFrom,
    l.availableTo,
    JSON.stringify(l.blocked),
    JSON.stringify(l.photos),
    l.status,
  ];
}
export async function seedWorkspace(c: PoolClient, workspaceId: string, mode: "demo" | "test" = "demo") {
  const ownerId = randomUUID(),
    renterId = randomUUID();
  await c.query("INSERT INTO workspaces(id,mode) VALUES($1,$2)", [workspaceId, mode]);
  await c.query(
    "INSERT INTO users(id,workspace_id,name,demo_role) VALUES($1,$3,'مالک نمونه','owner'),($2,$3,'اجاره‌کنندهٔ نمونه','renter')",
    [ownerId, renterId, workspaceId],
  );
  for (const l of demoInventory())
    await c.query(
      `INSERT INTO listings(id,workspace_id,owner_id,synthetic,${listingColumns.join(",")}) VALUES($1,$2,$3,true,${listingColumns.map((_, i) => `$${i + 4}`).join(",")})`,
      [randomUUID(), workspaceId, ownerId, ...listingValues(l)],
    );
  return { ownerId, renterId };
}
