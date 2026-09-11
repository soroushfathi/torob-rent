"use client";
import { useEffect, useRef, useState } from "react";
import {
  Search,
  Sparkles,
  MapPin,
  SlidersHorizontal,
  ArrowLeft,
  RotateCcw,
  Check,
  Info,
  Laptop,
  ChevronDown,
} from "lucide-react";
import { api, useApp } from "./provider";
import { DateField, Field, ListingCard, SkeletonCards, Notice } from "./ui";
import {
  defaultRequirements,
  neighborhoods,
  chips,
  fa,
  latin,
  money,
  rentalDays,
  type Requirements,
  type Listing,
} from "@/lib/domain";
type Result = { listings: Listing[]; total: number; searchId: string; requirements: Requirements };
export function SearchPage() {
  const app = useApp(),
    [text, setText] = useState(""),
    [items, setItems] = useState<Listing[]>([]),
    [loading, setLoading] = useState(true),
    [parsing, setParsing] = useState(false),
    [questions, setQuestions] = useState<string[]>([]),
    [inferred, setInferred] = useState(false),
    [provider, setProvider] = useState(""),
    [sort, setSort] = useState("balanced"),
    [filtersOpen, setFiltersOpen] = useState(false),
    [active, setActive] = useState<Requirements>(app.requirements);
  const lastUser = useRef("");
  async function search(r = app.requirements) {
    setLoading(true);
    app.setError("");
    try {
      const res = await api<Result>("search", r);
      setItems(res.listings);
      setActive(res.requirements);
      app.setSearchId(res.searchId);
      setInferred(false);
      setFiltersOpen(false);
    } catch (e) {
      app.setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (app.user && lastUser.current !== app.user.id) {
      lastUser.current = app.user.id;
      void search();
    }
  }, [app.user]); // eslint-disable-line react-hooks/exhaustive-deps
  function change<K extends keyof Requirements>(key: K, value: Requirements[K]) {
    app.setRequirements({ ...app.requirements, [key]: value });
  }
  async function parse() {
    if (text.trim().length < 3) return;
    setParsing(true);
    try {
      const r = await api<{ requirements: Requirements; questions: string[]; provider: string }>("ai", {
        capability: "search",
        text,
        requirements: app.requirements,
      });
      app.setRequirements(r.requirements);
      setQuestions(r.questions);
      setProvider(r.provider);
      setInferred(true);
      setFiltersOpen(true);
    } catch (e) {
      app.setError((e as Error).message);
    } finally {
      setParsing(false);
    }
  }
  let days = 3;
  try {
    days = rentalDays(active.startDate, active.endDate);
  } catch {}
  const ordered = items
    .slice()
    .sort((a, b) =>
      sort === "deposit" ? a.deposit - b.deposit : sort === "price" ? a.dailyPrice - b.dailyPrice : 0,
    );
  const num = (v: string) => (v === "" ? null : Number(latin(v).replace(/[٬,]/g, "")));
  const r = app.requirements;
  const dirty = JSON.stringify(r) !== JSON.stringify(active);
  return (
    <>
      <section className="search-intro">
        <div className="eyebrow">
          <span className="tiny-line" />
          اجارهٔ مک‌بوک برای تدوین
        </div>
        <div className="intro-title">
          <h1>
            پروژه از تو، <span>مک‌بوک از اینجا.</span>
          </h1>
          <span className="location-pill">
            <MapPin size={16} />
            تهران
            <ChevronDown size={14} />
          </span>
        </div>
        <p>برای چند روزی که به دستگاه نیاز داری؛ با هزینه و شرایطی که از اول روشن است.</p>
        <form
          className="natural-search"
          onSubmit={(e) => {
            e.preventDefault();
            void parse();
          }}
        >
          <Sparkles className="search-spark" size={23} />
          <input
            aria-label="نیازتان را به فارسی بنویسید"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="مثلاً: برای سه روز تدوین 4K، بودجه ۳ میلیون و ودیعه تا ۳۵ میلیون…"
            maxLength={3000}
          />
          <button className="btn primary" type="submit" disabled={parsing || !text.trim()}>
            {parsing ? "در حال پردازش…" : "تبدیل به فیلتر"}
            <ArrowLeft size={17} />
          </button>
        </form>
        <div className="search-examples">
          <span>امتحان کن:</span>
          {[
            "سه روز تدوین 4K با پریمیر، بودجه ۳ میلیون، ودیعه ۳۵ میلیون",
            "پنج روز تدوین سنگین با داوینچی، رم ۳۲",
            "دو روز در ونک، ودیعه ۲۰ میلیون",
          ].map((s, i) => (
            <button key={s} onClick={() => setText(s)}>
              {["تدوین 4K اقتصادی", "پروژهٔ سنگین", "ودیعهٔ کمتر"][i]}
            </button>
          ))}
          <span className="ai-mode">
            <span className={app.aiConfigured ? "online-dot" : "offline-dot"} />
            {app.aiConfigured ? "دستیار متصل" : "پردازش قاعده‌محور · مدل متصل نیست"}
          </span>
        </div>
      </section>
      {inferred && (
        <Notice>
          <div className="inference">
            <Sparkles size={20} />
            <div>
              <b>فیلترها از متن شما استخراج شدند.</b>
              <p>
                منبع: {provider === "model" ? "مدل زبانی" : "قواعد متنی، بدون مدل"}. آن‌ها را بررسی کنید و
                «نمایش نتایج» را بزنید. هیچ محدودیتی خودکار حذف نمی‌شود.
              </p>
              {questions.map((q) => (
                <p key={q}>• {q}</p>
              ))}
            </div>
          </div>
        </Notice>
      )}
      <div className="catalog-layout">
        <aside className={`filters ${filtersOpen ? "filters-open" : ""}`} aria-label="فیلترهای جست‌وجو">
          <div className="filter-heading">
            <h2>
              <SlidersHorizontal size={18} />
              فیلترها
            </h2>
            <button className="text-button" onClick={() => app.setRequirements(defaultRequirements())}>
              پاک کردن
            </button>
          </div>
          <div className="filter-section">
            <h3>چه زمانی نیاز داری؟</h3>
            <DateField label="دریافت دستگاه" value={r.startDate} onChange={(v) => change("startDate", v)} />
            <DateField label="بازگشت دستگاه" value={r.endDate} onChange={(v) => change("endDate", v)} />
            <small className="subtle">شروع شامل بازه است؛ روز بازگشت محاسبه نمی‌شود.</small>
          </div>
          <div className="filter-section">
            <h3>بودجه و ودیعه</h3>
            <Field label="سقف کل اجاره (تومان)">
              <input
                inputMode="numeric"
                placeholder="بدون محدودیت"
                value={r.budget ?? ""}
                onChange={(e) => change("budget", num(e.target.value))}
              />
            </Field>
            <Field label="حداکثر ودیعه (تومان)">
              <input
                inputMode="numeric"
                placeholder="بدون محدودیت"
                value={r.maxDeposit ?? ""}
                onChange={(e) => change("maxDeposit", num(e.target.value))}
              />
            </Field>
            <div className="filter-tip">
              <Info size={16} />
              <span>ودیعه هزینهٔ اجاره نیست؛ جداگانه مقایسه‌اش کن.</span>
            </div>
          </div>
          <div className="filter-section">
            <Field label="محله">
              <select value={r.neighborhood} onChange={(e) => change("neighborhood", e.target.value)}>
                <option value="">همهٔ تهران</option>
                {neighborhoods.slice(1).map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </Field>
            <Field label="نوع تدوین">
              <select
                value={r.workload}
                onChange={(e) => change("workload", e.target.value as Requirements["workload"])}
              >
                <option value="unknown">هنوز مشخص نیست</option>
                <option value="1080p">تدوین 1080p</option>
                <option value="4k">تدوین 4K · حداقل ۱۶ گیگ رم</option>
                <option value="heavy">سنگین / چنددوربینه · ۳۲ گیگ رم</option>
              </select>
            </Field>
            <Field label="نرم‌افزار">
              <select
                value={r.software}
                onChange={(e) => change("software", e.target.value as Requirements["software"])}
              >
                <option value="unknown">هنوز مشخص نیست</option>
                <option>Premiere</option>
                <option>Final Cut</option>
                <option>DaVinci</option>
              </select>
            </Field>
            <Field label="حداقل رم">
              <select value={r.minRam ?? ""} onChange={(e) => change("minRam", num(e.target.value))}>
                <option value="">بدون محدودیت</option>
                {[8, 16, 24, 32, 64].map((n) => (
                  <option value={n} key={n}>
                    {fa(n)} گیگابایت
                  </option>
                ))}
              </select>
            </Field>
            <Field label="تراشه">
              <select value={r.chip} onChange={(e) => change("chip", e.target.value)}>
                <option value="">همهٔ تراشه‌ها</option>
                {chips.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
          </div>
          <button className="btn primary full" disabled={loading} onClick={() => void search()}>
            <Search size={17} />
            {loading ? "در حال جست‌وجو…" : "نمایش نتایج"}
          </button>
          {dirty && <small className="filter-pending">فیلترها تغییر کرده‌اند؛ نتایج را به‌روز کنید.</small>}
        </aside>
        <section className="results">
          <div className="results-heading">
            <div>
              <h2>
                <Laptop size={21} />
                {loading ? "مک‌بوک‌های قابل اجاره" : `${fa(items.length)} مک‌بوک برای این بازه`}
              </h2>
              <p>هزینهٔ {fa(days)} روز، همراه با ودیعهٔ جداگانه</p>
            </div>
            <div className="result-actions">
              <button className="btn secondary mobile-filters" onClick={() => setFiltersOpen(!filtersOpen)}>
                <SlidersHorizontal size={17} />
                فیلتر
              </button>
              <select aria-label="مرتب‌سازی" value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="balanced">هزینه و ودیعهٔ متعادل</option>
                <option value="price">کمترین هزینهٔ اجاره</option>
                <option value="deposit">کمترین ودیعه</option>
              </select>
            </div>
          </div>
          <div className="applied-filters">
            <span>
              <Check size={13} />
              آزاد در بازهٔ انتخابی
            </span>
            {active.budget !== null && <span>اجاره تا {money(active.budget)}</span>}
            {active.maxDeposit !== null && <span>ودیعه تا {money(active.maxDeposit)}</span>}
            {active.workload !== "unknown" && (
              <span>تدوین {active.workload === "heavy" ? "سنگین" : active.workload}</span>
            )}
            {active.neighborhood && <span>{active.neighborhood}</span>}
          </div>
          {loading ? (
            <SkeletonCards />
          ) : ordered.length ? (
            <div className="cards">
              {ordered.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          ) : (
            <div className="empty no-results">
              <Search size={38} />
              <h2>با این شرایط، پیشنهادی پیدا نشد.</h2>
              <p>
                می‌توانید تاریخ، سقف هزینه یا ودیعه را خودتان تغییر دهید. محدودیت‌ها را برایتان تغییر نداده‌ایم.
              </p>
              <button
                className="btn secondary"
                onClick={() => {
                  const fresh = defaultRequirements();
                  app.setRequirements(fresh);
                  void search(fresh);
                }}
              >
                <RotateCcw size={16} />
                بازنشانی فیلترها با انتخاب من
              </button>
            </div>
          )}
          <div className="results-note">
            <Info size={16} />
            <p>
              ترتیب متعادل، هزینهٔ کل اجاره و یک‌صدم ودیعه را جمع می‌کند؛ امتیاز عملکرد نیست. پیشنهادها بر اساس
              مشخصات ثبت‌شده و قواعد اولیهٔ تدوین فیلتر شده‌اند. سازگاری کُدک و نرم‌افزار را با مالک بررسی کنید.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
