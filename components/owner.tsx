"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  Pause,
  Play,
  Sparkles,
  Upload,
  X,
  ArrowLeft,
  Package,
  Inbox,
  Check,
} from "lucide-react";
import { api, useApp } from "./provider";
import { Loading, Notice, Field, DateField } from "./ui";
import {
  addDays,
  todayTehran,
  neighborhoods,
  chips,
  money,
  fa,
  listingSchema,
  latin,
  type Listing,
  type ListingInput,
} from "@/lib/domain";
import type { Draft } from "@/lib/ai-parser";
export function OwnerPage() {
  const app = useApp(),
    [listings, setListings] = useState<Listing[]>([]),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState("");
  async function load() {
    try {
      setListings((await api<{ listings: Listing[] }>("listings?own=true")).listings);
    } catch (e) {
      app.setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [app.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  async function toggle(l: Listing) {
    setSaving(l.id);
    try {
      await api(
        `listings/${l.id}`,
        { ...l, status: l.status === "published" ? "paused" : "published" },
        "PUT",
      );
      await load();
    } catch (e) {
      app.setError((e as Error).message);
    } finally {
      setSaving("");
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">پنل مالک</div>
          <h1>دستگاه‌های من</h1>
          <p>آگهی‌ها، دسترس‌پذیری و درخواست‌های اجاره را مدیریت کنید.</p>
        </div>
        <div className="button-row">
          <Link className="btn secondary" href="/owner/requests">
            <Inbox size={18} />
            درخواست‌های اجاره
          </Link>
          <Link className="btn primary" href="/owner/new">
            <Plus size={18} />
            ثبت دستگاه جدید
          </Link>
        </div>
      </div>
      {app.user?.role === "renter" && (
        <Notice>
          اکنون در نقش اجاره‌کنندهٔ دمو هستید. می‌توانید آگهی خودتان را بسازید یا از نوار بالای صفحه، نقش مالک
          نمونه را امتحان کنید.
        </Notice>
      )}
      {loading ? (
        <Loading />
      ) : !listings.length ? (
        <div className="empty">
          <Package size={40} />
          <h2>اولین دستگاهت را معرفی کن.</h2>
          <p>مشخصات، عکس و روزهایی که دستگاه آزاد است را اضافه کن.</p>
          <Link href="/owner/new" className="btn primary">
            ساخت اولین آگهی
          </Link>
        </div>
      ) : (
        <div className="owner-list">
          {listings.map((l) => (
            <article className="owner-row" key={l.id}>
              <img src={l.photos[0] || "/images/macbook-pro.jpg"} alt={l.title} />
              <div className="owner-row-title">
                <h2 dir="ltr">{l.title}</h2>
                <span>
                  {l.neighborhood} · {l.ram ? `${fa(l.ram)} گیگ رم` : "رم نامشخص"}
                </span>
                <span className={`status ${l.status === "published" ? "accepted" : "requested"}`}>
                  {l.status === "published" ? "منتشرشده" : l.status === "paused" ? "متوقف" : "پیش‌نویس"}
                </span>
              </div>
              <div className="owner-row-price">
                <b>{money(l.dailyPrice)}</b>
                <small>روزانه</small>
              </div>
              <div className="button-row">
                <Link href={`/owner/edit/${l.id}`} className="btn secondary small">
                  <Pencil size={16} />
                  ویرایش
                </Link>
                <button className="btn ghost small" disabled={saving === l.id} onClick={() => void toggle(l)}>
                  {l.status === "published" ? <Pause size={16} /> : <Play size={16} />}{" "}
                  {l.status === "published" ? "توقف" : "انتشار"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
const blank = (): ListingInput => ({
  title: "",
  model: "",
  chip: null,
  ram: null,
  storage: null,
  description: "",
  condition: "good",
  accessories: [],
  neighborhood: "یوسف‌آباد",
  dailyPrice: 0,
  deposit: 0,
  minDays: 1,
  guarantee: "",
  availableFrom: todayTehran(),
  availableTo: addDays(todayTehran(), 90),
  blocked: [],
  photos: [],
  status: "draft",
});
export function EditorPage({ id }: { id?: string }) {
  const app = useApp(),
    router = useRouter(),
    [form, setForm] = useState<ListingInput>(blank),
    [loading, setLoading] = useState(!!id),
    [saving, setSaving] = useState(false),
    [uploading, setUploading] = useState(false),
    [description, setDescription] = useState(""),
    [draft, setDraft] = useState<Draft | null>(null),
    [draftProvider, setDraftProvider] = useState(""),
    [parsing, setParsing] = useState(false),
    [reviewed, setReviewed] = useState(false),
    [errors, setErrors] = useState<string[]>([]),
    [accessory, setAccessory] = useState("");
  const [blockedStart, setBlockedStart] = useState(addDays(todayTehran(), 5)),
    [blockedEnd, setBlockedEnd] = useState(addDays(todayTehran(), 7));
  useEffect(() => {
    if (id)
      api<{ listing: Listing }>(`listings/${id}`)
        .then((r) => setForm(r.listing))
        .catch((e) => setErrors([e.message]))
        .finally(() => setLoading(false));
  }, [id]);
  function change<K extends keyof ListingInput>(key: K, value: ListingInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setReviewed(false);
  }
  async function parse() {
    setParsing(true);
    try {
      const r = await api<{ draft: Draft; provider: string }>("ai", {
        capability: "listing",
        text: description,
      });
      setDraft(r.draft);
      setDraftProvider(r.provider);
    } catch (e) {
      setErrors([(e as Error).message]);
    } finally {
      setParsing(false);
    }
  }
  function applyDraft() {
    if (!draft) return;
    setForm((f) => ({
      ...f,
      model: draft.model ?? f.model,
      chip: draft.chip ?? f.chip,
      ram: draft.ram ?? f.ram,
      storage: draft.storage ?? f.storage,
      title: draft.model ? `${draft.model}${draft.chip ? ` · ${draft.chip}` : ""}` : f.title,
      accessories: draft.accessories.length ? draft.accessories : f.accessories,
      description,
    }));
    setReviewed(false);
    setDraft(null);
  }
  async function upload(file: File) {
    setUploading(true);
    try {
      const data = new FormData();
      data.set("file", file);
      const res = await fetch("/api/media", { method: "POST", body: data });
      const r = await res.json();
      if (!res.ok) throw new Error(r.error);
      change("photos", [...form.photos, r.url]);
    } catch (e) {
      setErrors([(e as Error).message]);
    } finally {
      setUploading(false);
    }
  }
  async function save(status: ListingInput["status"]) {
    setErrors([]);
    if (status === "published" && !reviewed) {
      setErrors(["پیش از انتشار، بررسی مشخصات و شرایط را تأیید کنید."]);
      return;
    }
    const validated = listingSchema.safeParse({ ...form, status });
    if (!validated.success) {
      setErrors(validated.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
      return;
    }
    setSaving(true);
    try {
      await api(id ? `listings/${id}` : "listings", validated.data, id ? "PUT" : "POST");
      router.push("/owner");
    } catch (e) {
      setErrors([(e as Error).message]);
    } finally {
      setSaving(false);
    }
  }
  const number = (v: string) => Number(latin(v).replace(/[٬,]/g, ""));
  if (loading) return <Loading />;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">پنل مالک / {id ? "ویرایش آگهی" : "آگهی جدید"}</div>
          <h1>{id ? "مشخصات دستگاه را به‌روز کن." : "مک‌بوکت را برای اجاره آماده کن."}</h1>
          <p>اطلاعات نامشخص را خالی بگذار؛ چیزی را از روی ظاهر حدس نمی‌زنیم.</p>
        </div>
        <Link className="btn secondary" href="/owner">
          بازگشت به آگهی‌ها
        </Link>
      </div>
      <div className="editor-layout">
        <div className="editor-main">
          <section className="editor-section assisted-draft">
            <h2>
              <Sparkles size={22} />
              از یک توضیح ساده شروع کن.
            </h2>
            <p>مدل، رم، حافظه و لوازم همراه را بنویس؛ پیش‌نویس را پیش از استفاده بررسی کن.</p>
            <textarea
              rows={3}
              aria-label="توضیح آزاد دستگاه"
              placeholder="مک‌بوک پرو M2 Pro دارم، رم ۱۶ گیگ، حافظه ۵۱۲ گیگ، همراه شارژر و کیف…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="assisted-footer">
              <small>{app.aiConfigured ? "پردازش با مدل متصل" : "پردازش قاعده‌محور · مدل متصل نیست"}</small>
              <button
                disabled={parsing || description.length < 3}
                className="btn ink small"
                onClick={() => void parse()}
              >
                <Sparkles size={16} />
                {parsing ? "در حال ساخت…" : "ساخت پیش‌نویس"}
              </button>
            </div>
            {draft && (
              <div className="draft-preview">
                <b>پیش‌نویس قابل بررسی · {draftProvider === "model" ? "مدل زبانی" : "قواعد متنی"}</b>
                <p>
                  {draft.model || "مدل نامشخص"} · {draft.chip || "تراشه نامشخص"} · رم{" "}
                  {draft.ram ? fa(draft.ram) : "نامشخص"} · حافظه{" "}
                  {draft.storage ? fa(draft.storage) : "نامشخص"}
                </p>
                <p>نیازمند تکمیل: {draft.missing.join("، ")}</p>
                <button className="btn secondary" onClick={applyDraft}>
                  <Check size={16} />
                  بررسی کردم؛ انتقال به فرم
                </button>
              </div>
            )}
          </section>
          <section className="editor-section">
            <h2>
              <span className="step-number">۱</span>مشخصات دستگاه
            </h2>
            <Field label="عنوان آگهی">
              <input
                value={form.title}
                onChange={(e) => change("title", e.target.value)}
                placeholder="MacBook Pro 14 · M2 Pro"
              />
            </Field>
            <div className="form-grid">
              <Field label="مدل">
                <input
                  value={form.model}
                  onChange={(e) => change("model", e.target.value)}
                  placeholder="MacBook Pro 14"
                />
              </Field>
              <Field label="تراشه">
                <select value={form.chip || ""} onChange={(e) => change("chip", e.target.value || null)}>
                  <option value="">نامشخص</option>
                  {chips.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="رم (گیگابایت)">
                <input
                  inputMode="numeric"
                  value={form.ram ?? ""}
                  onChange={(e) => change("ram", e.target.value ? number(e.target.value) : null)}
                  placeholder="نامشخص"
                />
              </Field>
              <Field label="حافظهٔ داخلی (گیگابایت)">
                <input
                  inputMode="numeric"
                  value={form.storage ?? ""}
                  onChange={(e) => change("storage", e.target.value ? number(e.target.value) : null)}
                  placeholder="نامشخص"
                />
              </Field>
              <Field label="وضعیت ظاهری">
                <select
                  value={form.condition}
                  onChange={(e) => change("condition", e.target.value as ListingInput["condition"])}
                >
                  <option value="excellent">بسیار خوب</option>
                  <option value="good">خوب</option>
                  <option value="fair">دارای آثار استفاده</option>
                </select>
              </Field>
              <Field label="محلهٔ تحویل">
                <select value={form.neighborhood} onChange={(e) => change("neighborhood", e.target.value)}>
                  {neighborhoods.slice(1).map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="توضیحات و نکات مهم">
              <textarea
                rows={4}
                value={form.description}
                onChange={(e) => change("description", e.target.value)}
              />
            </Field>
            <Field label="لوازم همراه">
              <div className="input-action">
                <input
                  value={accessory}
                  onChange={(e) => setAccessory(e.target.value)}
                  placeholder="مثلاً شارژر یا کیف"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (accessory.trim()) {
                        change("accessories", [...new Set([...form.accessories, accessory.trim()])]);
                        setAccessory("");
                      }
                    }
                  }}
                />
                <button
                  className="btn secondary small"
                  onClick={() => {
                    if (accessory.trim()) {
                      change("accessories", [...new Set([...form.accessories, accessory.trim()])]);
                      setAccessory("");
                    }
                  }}
                >
                  افزودن
                </button>
              </div>
            </Field>
            <div className="tag-list">
              {form.accessories.map((a) => (
                <button
                  key={a}
                  onClick={() =>
                    change(
                      "accessories",
                      form.accessories.filter((x) => x !== a),
                    )
                  }
                >
                  {a}
                  <X size={13} />
                </button>
              ))}
            </div>
          </section>
          <section className="editor-section">
            <h2>
              <span className="step-number">۲</span>عکس‌های دستگاه
            </h2>
            <p>JPEG، PNG یا WebP، حداکثر ۵ مگابایت؛ تا ۶ عکس. فرادادهٔ تصاویر حذف می‌شود.</p>
            <div className="upload-grid">
              {form.photos.map((p) => (
                <div className="upload-thumb" key={p}>
                  <img src={p} alt="عکس آگهی" />
                  <button
                    className="icon-button"
                    aria-label="حذف عکس"
                    onClick={() =>
                      change(
                        "photos",
                        form.photos.filter((x) => x !== p),
                      )
                    }
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              {form.photos.length < 6 && (
                <label className="upload-box">
                  <Upload size={28} />
                  <span>{uploading ? "در حال بارگذاری…" : "افزودن عکس"}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void upload(f);
                    }}
                  />
                </label>
              )}
            </div>
            {app.user?.mode !== "real" && form.photos.length === 0 && (
              <button className="text-button" onClick={() => change("photos", ["/images/macbook-pro.jpg"])}>
                استفاده از عکس نمونه در این دمو
              </button>
            )}
          </section>
          <section className="editor-section">
            <h2>
              <span className="step-number">۳</span>قیمت و شرایط اجاره
            </h2>
            <div className="form-grid">
              <Field label="اجارهٔ روزانه (تومان)">
                <input
                  inputMode="numeric"
                  value={form.dailyPrice || ""}
                  onChange={(e) => change("dailyPrice", number(e.target.value))}
                />
              </Field>
              <Field label="ودیعهٔ بازگشت‌پذیر (تومان)">
                <input
                  inputMode="numeric"
                  value={form.deposit}
                  onChange={(e) => change("deposit", number(e.target.value))}
                />
              </Field>
              <Field label="حداقل مدت اجاره (روز)">
                <input
                  inputMode="numeric"
                  value={form.minDays}
                  onChange={(e) => change("minDays", number(e.target.value))}
                />
              </Field>
            </div>
            <Field label="شرایط ضمانت و هماهنگی">
              <textarea
                rows={3}
                value={form.guarantee}
                onChange={(e) => change("guarantee", e.target.value)}
                placeholder="شرایط موردنظر را توضیح دهید؛ هیچ مدرک یا ضمانتی در این نمونه دریافت نمی‌شود."
              />
            </Field>
          </section>
          <section className="editor-section">
            <h2>
              <span className="step-number">۴</span>چه زمانی آزاد است؟
            </h2>
            <div className="form-grid">
              <DateField
                label="اولین روز دسترس‌پذیری"
                value={form.availableFrom}
                onChange={(v) => change("availableFrom", v)}
              />
              <DateField
                label="آخرین روز بازگشت"
                value={form.availableTo}
                onChange={(v) => change("availableTo", v)}
              />
            </div>
            <h3>افزودن بازهٔ غیرقابل اجاره</h3>
            <div className="form-grid">
              <DateField label="شروع بازهٔ مسدود" value={blockedStart} onChange={setBlockedStart} />
              <DateField label="پایان بازهٔ مسدود" value={blockedEnd} onChange={setBlockedEnd} />
            </div>
            <button
              className="btn secondary small"
              onClick={() => {
                if (blockedStart < blockedEnd)
                  change("blocked", [...form.blocked, { start: blockedStart, end: blockedEnd }]);
                else setErrors(["پایان بازه باید بعد از شروع باشد."]);
              }}
            >
              افزودن بازه
            </button>
            <div className="tag-list">
              {form.blocked.map((b, i) => (
                <button
                  key={`${b.start}-${i}`}
                  onClick={() =>
                    change(
                      "blocked",
                      form.blocked.filter((_, j) => i !== j),
                    )
                  }
                >
                  {new Intl.DateTimeFormat("fa-IR").format(new Date(b.start))} تا{" "}
                  {new Intl.DateTimeFormat("fa-IR").format(new Date(b.end))}
                  <X size={13} />
                </button>
              ))}
            </div>
          </section>
        </div>
        <aside className="editor-summary">
          <h2>آمادهٔ انتشار؟</h2>
          <p>قیمت و شرایط در هر درخواست ذخیره می‌شوند؛ ویرایش آگهی توافق‌های قبلی را تغییر نمی‌دهد.</p>
          <div className="summary-prices">
            <span>اجارهٔ روزانه</span>
            <strong>{money(form.dailyPrice)}</strong>
            <span>ودیعهٔ جداگانه</span>
            <b>{money(form.deposit)}</b>
          </div>
          <label className="checkbox-line">
            <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} />
            <span>مشخصات، لوازم و شرایط را بررسی کرده‌ام و اطلاعات نامشخص را حدس نزده‌ام.</span>
          </label>
          {errors.length > 0 && (
            <div role="alert" className="inline-error">
              {errors.map((e, i) => (
                <p key={i}>{e}</p>
              ))}
            </div>
          )}
          <button
            className="btn primary full"
            disabled={saving || uploading}
            onClick={() => void save("published")}
          >
            {saving ? "در حال ذخیره…" : "انتشار آگهی"}
            <ArrowLeft size={17} />
          </button>
          <button
            className="btn secondary full"
            disabled={saving || uploading}
            onClick={() => void save("draft")}
          >
            ذخیرهٔ پیش‌نویس
          </button>
          <small>این نمونه هیچ ادعایی دربارهٔ مالکیت، اصالت یا سلامت تأییدشدهٔ دستگاه ندارد.</small>
        </aside>
      </div>
    </>
  );
}
