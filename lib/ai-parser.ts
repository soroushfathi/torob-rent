import { z } from "zod";
import {
  latin,
  neighborhoods,
  chips,
  addDays,
  todayTehran,
  normalizeDate,
  requirementsSchema,
  type Requirements,
} from "./domain";
export const extractionSchema = z
  .object({
    startDate: z.string().nullable(),
    endDate: z.string().nullable(),
    budget: z.number().int().min(0).max(1e9).nullable(),
    maxDeposit: z.number().int().min(0).max(1e9).nullable(),
    minRam: z.number().int().min(0).max(128).nullable(),
    neighborhood: z.string().max(50).nullable(),
    chip: z.string().max(30).nullable(),
    workload: z.enum(["unknown", "1080p", "4k", "heavy"]),
    software: z.enum(["unknown", "Premiere", "Final Cut", "DaVinci"]),
    questions: z.array(z.string().max(180)).max(4),
  })
  .strict();
export const draftSchema = z
  .object({
    model: z.string().max(80).nullable(),
    chip: z.string().max(30).nullable(),
    ram: z.number().int().min(1).max(128).nullable(),
    storage: z.number().int().min(1).max(8192).nullable(),
    accessories: z.array(z.string().max(100)).max(12),
    missing: z.array(z.string().max(100)).max(12),
  })
  .strict();
export type Draft = z.infer<typeof draftSchema>;
const words: Record<string, string> = {
  یک: "1",
  دو: "2",
  سه: "3",
  چهار: "4",
  پنج: "5",
  شش: "6",
  هفت: "7",
  هشت: "8",
  نه: "9",
  ده: "10",
  بیست: "20",
  سی: "30",
  چهل: "40",
  پنجاه: "50",
};
function numerals(s: string) {
  let t = latin(s).replace(/٬|,/g, "").replace(/٫/g, ".");
  for (const [w, n] of Object.entries(words))
    t = t.replace(new RegExp(`(^|[\\s،])${w}(?=[\\s،]|$)`, "g"), `$1${n}`);
  return t;
}
function amount(t: string, label: string) {
  const m = t.match(
    new RegExp(`(?:${label})[^\\d،.]{0,22}(\\d+(?:\\.\\d+)?)\\s*(میلیون|هزار|میلیارد)?\\s*(تومان|ریال)?`),
  );
  if (!m) return null;
  return Math.floor(
    (Number(m[1]) * (m[2] === "میلیون" ? 1e6 : m[2] === "هزار" ? 1e3 : m[2] === "میلیارد" ? 1e9 : 1)) /
      (m[3] === "ریال" ? 10 : 1),
  );
}
export function fallbackSearch(text: string, current: Requirements) {
  const t = numerals(text),
    r = { ...current };
  const budget = amount(t, "بودجه|هزینه اجاره|اجاره با سقف");
  const deposit = amount(t, "ودیعه|پول پیش|دیپازیت");
  if (budget !== null) r.budget = budget;
  if (deposit !== null) r.maxDeposit = deposit;
  const hood = neighborhoods.slice(1).find((n) => t.replace(/[‌\s-]/g, "").includes(n.replace(/[‌\s-]/g, "")));
  if (hood) r.neighborhood = hood;
  const chip = chips
    .slice()
    .sort((a, b) => b.length - a.length)
    .find((c) => t.toLowerCase().includes(c.toLowerCase()));
  if (chip) r.chip = chip;
  const ram = t.match(/(?:رم\s*(\d+)|(\d+)\s*گیگ(?:ابایت)?\s*رم)/);
  if (ram) r.minRam = Number(ram[1] || ram[2]);
  if (/سنگین|چند.?دوربین|8k/i.test(t)) r.workload = "heavy";
  else if (/4k|۴کی|فورکی/i.test(t)) r.workload = "4k";
  else if (/1080|فول.?اچ.?دی/i.test(t)) r.workload = "1080p";
  if (/پریمیر|premiere/i.test(t)) r.software = "Premiere";
  else if (/فاینال.?کات|final.?cut/i.test(t)) r.software = "Final Cut";
  else if (/داوینچی|davinci/i.test(t)) r.software = "DaVinci";
  const days = t.match(/(\d+)\s*روز/);
  if (/پس.?فردا/.test(t)) r.startDate = addDays(todayTehran(), 2);
  else if (/فردا/.test(t)) r.startDate = addDays(todayTehran(), 1);
  const dates = t.match(/(?:1[34]\d\d|20\d\d)[/-]\d{1,2}[/-]\d{1,2}/g);
  if (dates) {
    r.startDate = dates[0];
    if (dates[1]) r.endDate = dates[1];
  }
  if (days && !dates?.[1]) r.endDate = addDays(normalizeDate(r.startDate), Number(days[1]));
  const questions: string[] = [];
  if (r.software === "unknown") questions.push("با کدام نرم‌افزار تدوین می‌کنید؟");
  if (r.workload === "unknown") questions.push("تصاویر 1080p هستند یا 4K؟ تدوین چنددوربینه دارید؟");
  else if (r.workload === "4k" || r.workload === "heavy")
    questions.push("کُدک تصاویر و نیاز به پروکسی را با مالک بررسی کنید.");
  if (!dates && !/فردا/.test(t)) questions.push("تاریخ‌های پیش‌فرض را با زمان پروژه‌تان تطبیق دهید.");
  return { requirements: requirementsSchema.parse(r), questions, provider: "fallback" as const };
}
export function fallbackDraft(text: string): Draft {
  const t = latin(text);
  const chip =
    chips
      .slice()
      .sort((a, b) => b.length - a.length)
      .find((c) => t.toLowerCase().includes(c.toLowerCase())) || null;
  const ramMatch = t.match(/(?:رم\s*(\d+)|(\d+)\s*(?:گیگ(?:ابایت)?|gb)\s*(?:رم|ram)|ram\s*(\d+))/i);
  const storageMatch = t.match(
    /(?:حافظه|ssd|storage)\s*(\d+)\s*(ترابایت|tb|گیگابایت|گیگ|gb)?|(\d+)\s*(ترابایت|tb|گیگابایت|گیگ|gb)\s*(?:حافظه|ssd)/i,
  );
  const ram = ramMatch ? Number(ramMatch[1] || ramMatch[2] || ramMatch[3]) : null;
  const storage = storageMatch
    ? Number(storageMatch[1] || storageMatch[3]) *
      ((storageMatch[2] || storageMatch[4] || "").match(/ترابایت|tb/i) ? 1024 : 1)
    : null;
  const model = /pro|پرو/i.test(t) ? "MacBook Pro" : /air|ایر/i.test(t) ? "MacBook Air" : null;
  const accessories = [
    /شارژر/.test(t) ? "شارژر" : null,
    /کیف/.test(t) ? "کیف محافظ" : null,
    /تبدیل/.test(t) ? "تبدیل USB-C" : null,
  ].filter((s): s is string => !!s);
  const missing = [
    !model ? "مدل دستگاه" : null,
    !chip ? "تراشه" : null,
    !ram ? "مقدار رم" : null,
    !storage ? "ظرفیت حافظه" : null,
    "قیمت و ودیعه",
    "بازهٔ دسترس‌پذیری",
    "شرایط ظاهری و ضمانت",
  ].filter((s): s is string => !!s);
  return draftSchema.parse({ model, chip, ram, storage, accessories, missing });
}
