import { z } from "zod";
import { toGregorian, isValidJalaaliDate } from "jalaali-js";

export const neighborhoods = [
  "همهٔ تهران",
  "یوسف‌آباد",
  "ونک",
  "سعادت‌آباد",
  "صادقیه",
  "تهرانپارس",
  "پونک",
  "انقلاب",
  "جردن",
  "نارمک",
  "تجریش",
  "شهرک غرب",
  "پاسداران",
];
export const chips = [
  "M1",
  "M1 Pro",
  "M1 Max",
  "M2",
  "M2 Pro",
  "M2 Max",
  "M3",
  "M3 Pro",
  "M3 Max",
  "M4",
  "M4 Pro",
  "M4 Max",
  "Intel",
];
export const statuses = [
  "requested",
  "accepted",
  "rejected",
  "cancelled",
  "expired",
  "handed_over",
  "completed",
] as const;
export type BookingStatus = (typeof statuses)[number];
export const statusLabels: Record<BookingStatus, string> = {
  requested: "در انتظار مالک",
  accepted: "پذیرفته‌شده",
  rejected: "ردشده",
  cancelled: "لغوشده",
  expired: "منقضی‌شده",
  handed_over: "تحویل داده شد",
  completed: "پایان‌یافته",
};
export function latin(value: string): string {
  return value
    .replace(/[۰-۹٠-٩]/g, (d) =>
      String("۰۱۲۳۴۵۶۷۸۹".includes(d) ? "۰۱۲۳۴۵۶۷۸۹".indexOf(d) : "٠١٢٣٤٥٦٧٨٩".indexOf(d)),
    )
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک");
}
export const fa = (n: number) => new Intl.NumberFormat("fa-IR").format(n);
export const money = (n: number) => `${fa(n)} تومان`;
export function todayTehran(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function normalizeDate(value: string): string {
  const parts = latin(value).trim().split(/[-/]/).map(Number);
  if (parts.length !== 3 || parts.some((x) => !Number.isInteger(x))) return "";
  let [y, m, d] = parts;
  if (y < 1700) {
    if (!isValidJalaaliDate(y, m, d)) return "";
    const g = toGregorian(y, m, d);
    y = g.gy;
    m = g.gm;
    d = g.gd;
  }
  if (y < 2020 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return "";
  const s = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return new Date(`${s}T12:00:00Z`).toISOString().slice(0, 10) === s ? s : "";
}
export function persianDate(date: string, short = false) {
  return new Intl.DateTimeFormat("fa-IR", {
    timeZone: "Asia/Tehran",
    day: "numeric",
    month: short ? "short" : "long",
    ...(!short ? { year: "numeric" as const } : {}),
  }).format(new Date(`${date.slice(0, 10)}T12:00:00+03:30`));
}
export function rentalDays(start: string, end: string) {
  const days = (Date.parse(`${end}T12:00:00+03:30`) - Date.parse(`${start}T12:00:00+03:30`)) / 86400000;
  if (!Number.isInteger(days) || days < 1 || days > 30)
    throw new Error("مدت اجاره باید بین ۱ تا ۳۰ روز باشد.");
  return days;
}
export function quote(daily: number, deposit: number, start: string, end: string, feeBps = 500) {
  const days = rentalDays(start, end);
  if (
    ![daily, deposit, feeBps].every(Number.isSafeInteger) ||
    daily < 1 ||
    deposit < 0 ||
    feeBps < 0 ||
    feeBps > 10000
  )
    throw new Error("مبلغ نامعتبر است.");
  return {
    currency: "IRT" as const,
    days,
    daily,
    rental: daily * days,
    deposit,
    estimatedCommission: Math.floor((daily * days * feeBps) / 10000),
    feeBps,
    paymentMode: "simulated" as const,
  };
}
const intInput = (max = 1_000_000_000) =>
  z.preprocess(
    (v) => (typeof v === "string" ? Number(latin(v).replace(/[٬,\s]/g, "")) : v),
    z.number().int().min(0).max(max),
  );
const optionalInt = (max = 1_000_000_000) =>
  z.preprocess(
    (v) =>
      v === "" || v === undefined || v === null
        ? null
        : typeof v === "string"
          ? Number(latin(v).replace(/[٬,\s]/g, ""))
          : v,
    z.number().int().min(0).max(max).nullable(),
  );
export const dateSchema = z
  .string()
  .transform(normalizeDate)
  .refine((v) => v !== "", "تاریخ معتبر وارد کنید؛ مثال ۱۴۰۵/۰۶/۲۱");
export const requirementsSchema = z
  .object({
    startDate: dateSchema,
    endDate: dateSchema,
    budget: optionalInt(),
    maxDeposit: optionalInt(),
    minRam: optionalInt(128),
    neighborhood: z.string().max(50).default(""),
    chip: z.string().max(30).default(""),
    workload: z.enum(["unknown", "1080p", "4k", "heavy"]).default("unknown"),
    software: z.enum(["unknown", "Premiere", "Final Cut", "DaVinci"]).default("unknown"),
  })
  .refine(
    (v) => {
      try {
        return rentalDays(v.startDate, v.endDate) > 0;
      } catch {
        return false;
      }
    },
    { message: "بازهٔ اجاره باید ۱ تا ۳۰ روز باشد.", path: ["endDate"] },
  );
export type Requirements = z.infer<typeof requirementsSchema>;
export const defaultRequirements = (): Requirements => ({
  startDate: addDays(todayTehran(), 1),
  endDate: addDays(todayTehran(), 4),
  budget: null,
  maxDeposit: null,
  minRam: null,
  neighborhood: "",
  chip: "",
  workload: "unknown",
  software: "unknown",
});
export const listingSchema = z
  .object({
    title: z.string().trim().min(4).max(120),
    model: z.string().trim().min(2).max(80),
    chip: z.enum(chips as [string, ...string[]]).nullable(),
    ram: optionalInt(128),
    storage: optionalInt(8192),
    description: z.string().trim().max(3000),
    condition: z.enum(["excellent", "good", "fair"]),
    accessories: z.array(z.string().trim().min(1).max(100)).max(12),
    neighborhood: z.enum(neighborhoods.slice(1) as [string, ...string[]]),
    dailyPrice: intInput(100_000_000).refine((v) => v >= 1000, "حداقل مبلغ روزانه ۱۰۰۰ تومان است."),
    deposit: intInput(),
    minDays: intInput(30).refine((v) => v >= 1),
    guarantee: z.string().max(1000),
    availableFrom: dateSchema,
    availableTo: dateSchema,
    blocked: z.array(z.object({ start: dateSchema, end: dateSchema })).max(20),
    photos: z.array(z.string().max(150)).max(6),
    status: z.enum(["draft", "published", "paused"]),
  })
  .superRefine((v, ctx) => {
    if (v.availableFrom >= v.availableTo)
      ctx.addIssue({
        code: "custom",
        message: "پایان دسترس‌پذیری باید بعد از شروع باشد.",
        path: ["availableTo"],
      });
    for (const b of v.blocked)
      if (b.start >= b.end)
        ctx.addIssue({ code: "custom", message: "بازهٔ مسدود نامعتبر است.", path: ["blocked"] });
    if (v.status === "published" && v.photos.length === 0)
      ctx.addIssue({ code: "custom", message: "برای انتشار حداقل یک عکس اضافه کنید.", path: ["photos"] });
  });
export type ListingInput = z.infer<typeof listingSchema>;
export type Listing = ListingInput & {
  id: string;
  ownerId: string;
  workspaceId: string;
  synthetic: boolean;
  createdAt: string;
  ownerName: string;
};
export function suitability(l: Pick<Listing, "ram" | "chip" | "storage">, r: Requirements) {
  const reasons: string[] = [];
  const minimum = r.workload === "heavy" ? 32 : r.workload === "4k" ? 16 : r.workload === "1080p" ? 8 : 0;
  const needed = Math.max(minimum, r.minRam || 0);
  if (needed && (l.ram === null || l.ram < needed))
    return { eligible: false, reasons: [`برای این نیاز حداقل ${fa(needed)} گیگابایت رمِ ثبت‌شده لازم است.`] };
  if (r.workload === "heavy" && (!l.chip || l.chip === "Intel"))
    return { eligible: false, reasons: ["برای این سناریوی سنگین، تراشهٔ Apple Siliconِ مشخص لازم است."] };
  if (needed)
    reasons.push(
      `رم ${fa(l.ram!)} گیگابایتی، حداقل قاعدهٔ ${r.workload === "heavy" ? "تدوین سنگین" : r.workload === "4k" ? "تدوین 4K" : "این جست‌وجو"} را پوشش می‌دهد.`,
    );
  if (l.ram === null) reasons.push("مقدار رم مشخص نیست؛ پیش از تصمیم از مالک بپرسید.");
  if (l.chip === "Intel" && r.software === "Final Cut")
    reasons.push("سازگاری نسخهٔ Final Cut و macOS را با مالک بررسی کنید.");
  if (l.storage !== null)
    reasons.push(`${fa(l.storage)} گیگابایت ظرفیت اسمی؛ فضای خالی باید با مالک بررسی شود.`);
  if (!needed) reasons.push("برای سنجش دقیق‌تر، نوع تدوین و نرم‌افزار را مشخص کنید.");
  reasons.push("این ارزیابی بر اساس مشخصات ثبت‌شده است؛ عملکرد یا سازگاری کُدک تضمین نمی‌شود.");
  return { eligible: true, reasons };
}
export function overlaps(a: string, b: string, c: string, d: string) {
  return a < d && c < b;
}
export function matches(l: Listing, r: Requirements) {
  const days = rentalDays(r.startDate, r.endDate);
  return (
    l.status === "published" &&
    l.availableFrom <= r.startDate &&
    l.availableTo >= r.endDate &&
    l.minDays <= days &&
    !l.blocked.some((b) => overlaps(r.startDate, r.endDate, b.start, b.end)) &&
    (r.budget === null || l.dailyPrice * days <= r.budget) &&
    (r.maxDeposit === null || l.deposit <= r.maxDeposit) &&
    (!r.neighborhood || r.neighborhood === l.neighborhood) &&
    (!r.chip || r.chip === l.chip) &&
    suitability(l, r).eligible
  );
}
export function canTransition(from: BookingStatus, to: BookingStatus, actor: "owner" | "renter" | "system") {
  const rules: Record<string, string[]> = {
    requested:
      actor === "owner" ? ["accepted", "rejected"] : actor === "renter" ? ["cancelled"] : ["expired"],
    accepted: actor === "owner" ? ["handed_over", "cancelled"] : actor === "renter" ? ["cancelled"] : [],
    handed_over: actor === "owner" ? ["completed"] : [],
  };
  return (rules[from] || []).includes(to);
}
export const preparationChecklist = [
  "از اطلاعات شخصی نسخهٔ پشتیبان بگیرید و فایل‌ها را از دستگاه خارج کنید.",
  "یک حساب کاربری موقت بسازید؛ رمز Apple ID یا حساب‌های شخصی را تحویل ندهید.",
  "پیش از بازگشت از فایل‌های پروژه نسخه بردارید و از حساب‌ها خارج شوید.",
  "حساب موقت و داده‌های پروژه را با توافق مالک پاک کنید و لوازم را تطبیق دهید.",
];
