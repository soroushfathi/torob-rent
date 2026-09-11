"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Clock3,
  FlaskConical,
  PackageCheck,
  RefreshCw,
  BarChart3,
  Search,
  LogIn,
  UserRound,
  ExternalLink,
} from "lucide-react";
import { api, useApp, type User } from "./provider";
import { DateRange, Field, Loading, Notice } from "./ui";
import {
  fa,
  money,
  statusLabels,
  canTransition,
  preparationChecklist,
  type BookingStatus,
} from "@/lib/domain";
type Booking = {
  id: string;
  listing_id: string;
  owner_id: string;
  renter_id: string;
  title: string;
  photos: string[];
  start_date: string;
  end_date: string;
  status: BookingStatus;
  rental_total: number;
  deposit: number;
  quote: { days: number; daily: number };
  terms: { title: string; accessories: string[]; guarantee: string };
  handoff: { condition: string } | null;
  return_report: { condition: string } | null;
  created_at: string;
  expires_at: string;
};
export function BookingsPage() {
  const app = useApp(),
    [items, setItems] = useState<Booking[]>([]),
    [loading, setLoading] = useState(true),
    [filter, setFilter] = useState("all"),
    [busy, setBusy] = useState("");
  const [reportFor, setReportFor] = useState<{ id: string; status: "handed_over" | "completed" } | null>(
      null,
    ),
    [condition, setCondition] = useState(""),
    [checked, setChecked] = useState<string[]>([]),
    [prepared, setPrepared] = useState(false),
    [message, setMessage] = useState("");
  async function load() {
    try {
      const r = await api<{ bookings: Booking[] }>("bookings");
      setItems(r.bookings);
    } catch (e) {
      app.setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [app.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  async function transition(id: string, status: BookingStatus) {
    setBusy(id);
    setMessage("");
    try {
      await api(
        `bookings/${id}`,
        {
          status,
          ...(status === "handed_over" || status === "completed"
            ? { report: { condition, accessories: checked, dataPrepared: prepared } }
            : {}),
        },
        "PATCH",
      );
      setReportFor(null);
      setMessage(
        status === "accepted"
          ? "درخواست پذیرفته شد؛ بازهٔ اجاره اکنون برای این دستگاه ثبت شده است."
          : "وضعیت با موفقیت ذخیره شد.",
      );
      await load();
    } catch (e) {
      app.setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  const labels: Partial<Record<BookingStatus, string>> = {
    accepted: "پذیرش درخواست",
    rejected: "رد درخواست",
    cancelled: "لغو درخواست",
    handed_over: "ثبت تحویل",
    completed: "ثبت بازگشت",
  };
  const shown = items.filter((b) => filter === "all" || b.status === filter);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">{app.user?.role === "owner" ? "پنل مالک" : "پیگیری اجاره"}</div>
          <h1>{app.user?.role === "owner" ? "درخواست‌های اجاره" : "درخواست‌های من"}</h1>
          <p>از اولین درخواست تا بازگشت دستگاه؛ هر مرحله روشن و ثبت‌شده است.</p>
        </div>
        <button className="btn secondary" onClick={() => void load()}>
          <RefreshCw size={17} />
          به‌روزرسانی
        </button>
      </div>
      <Notice tone="warning">
        <b>تمام پرداخت‌ها شبیه‌سازی می‌شوند.</b> درخواست اولیه رزرو قطعی نیست. پذیرش مالک همراه با بررسی اتمیک
        بازه، آن را تأیید می‌کند.
        {app.user?.mode !== "real" && (
          <p>
            در دمو می‌توانید تحویل و بازگشت را زودتر ثبت کنید تا مسیر کامل را ببینید؛ این مراحل صریحاً
            شبیه‌سازی‌اند.
          </p>
        )}
      </Notice>
      {message && <Notice tone="success">{message}</Notice>}
      <fieldset className="tabs" aria-label="فیلتر وضعیت">
        {[
          ["all", "همه"],
          ["requested", "در انتظار"],
          ["accepted", "پذیرفته‌شده"],
          ["handed_over", "تحویل‌شده"],
          ["completed", "پایان‌یافته"],
        ].map(([val, label]) => (
          <button className={filter === val ? "active" : ""} key={val} onClick={() => setFilter(val)}>
            {label}
            <span>{fa(items.filter((b) => val === "all" || b.status === val).length)}</span>
          </button>
        ))}
      </fieldset>
      {loading ? (
        <Loading />
      ) : !shown.length ? (
        <div className="empty">
          <Clock3 size={38} />
          <h2>درخواستی در این بخش نیست.</h2>
          <p>
            {app.user?.role === "owner"
              ? "در نقش اجاره‌کننده یک درخواست ثبت کنید، سپس به نقش مالک برگردید."
              : "یک مک‌بوک پیدا کنید و پس از بررسی شرایط، درخواست بدهید."}
          </p>
          <Link href="/" className="btn primary">
            پیدا کردن مک‌بوک
            <ArrowLeft size={17} />
          </Link>
        </div>
      ) : (
        <div className="booking-list">
          {shown.map((b) => {
            const role = b.owner_id === app.user?.id ? "owner" : "renter";
            const stages: BookingStatus[] = ["requested", "accepted", "handed_over", "completed"];
            const step = stages.indexOf(b.status);
            return (
              <article className="booking-card" key={b.id}>
                <div className="booking-top">
                  <img src={b.photos[0] || "/images/macbook-pro.jpg"} alt={b.terms.title} />
                  <div>
                    <Link href={`/listings/${b.listing_id}`}>
                      <h2 dir="ltr">{b.terms.title}</h2>
                    </Link>
                    <p>
                      <DateRange start={b.start_date} end={b.end_date} /> · {fa(b.quote.days)} روز · ساعت ۱۲
                    </p>
                    <small>
                      شما: {role === "owner" ? "مالک" : "اجاره‌کننده"} · شناسه {b.id.slice(0, 8)}
                    </small>
                  </div>
                  <span className={`status ${b.status}`}>{statusLabels[b.status]}</span>
                </div>
                {step >= 0 && (
                  <ol className="booking-timeline">
                    {stages.map((s, i) => (
                      <li className={i <= step ? "done" : ""} key={s}>
                        <span>{i < step ? <Check size={13} /> : fa(i + 1)}</span>
                        {["درخواست", "پذیرش مالک", "تحویل دستگاه", "بازگشت"][i]}
                      </li>
                    ))}
                  </ol>
                )}
                <div className="booking-money">
                  <span>
                    اجارهٔ توافق‌شده<strong>{money(b.rental_total)}</strong>
                  </span>
                  <span>
                    ودیعهٔ جداگانه<strong>{money(b.deposit)}</strong>
                  </span>
                  <span>
                    پرداخت واقعی<strong>غیرفعال</strong>
                  </span>
                </div>
                <details className="booking-terms">
                  <summary>شرایط ثبت‌شدهٔ درخواست</summary>
                  <p>{b.terms.guarantee || "شرط ضمانتی ثبت نشده است."}</p>
                  <p>لوازم: {b.terms.accessories.join("، ") || "ثبت نشده"}</p>
                  {b.handoff && <p>گزارش تحویل: {b.handoff.condition}</p>}
                  {b.return_report && <p>گزارش بازگشت: {b.return_report.condition}</p>}
                </details>
                {b.status === "requested" && (
                  <p className="subtle">
                    مهلت پاسخ مالک:{" "}
                    {new Intl.DateTimeFormat("fa-IR", {
                      dateStyle: "short",
                      timeStyle: "short",
                      timeZone: "Asia/Tehran",
                    }).format(new Date(b.expires_at))}
                  </p>
                )}
                {reportFor?.id === b.id && (
                  <div className="condition-report">
                    <h3>
                      <PackageCheck size={20} />
                      {reportFor.status === "handed_over" ? "گزارش تحویل دستگاه" : "گزارش بازگشت دستگاه"}
                    </h3>
                    <Field label="وضعیت ظاهری، عملکرد و هر مغایرت">
                      <textarea
                        value={condition}
                        onChange={(e) => setCondition(e.target.value)}
                        rows={3}
                        placeholder="مثلاً: بدنه بدون تغییر، نمایشگر سالم؛ شارژر و کیف تطبیق داده شدند."
                      />
                    </Field>
                    <h4>لوازم تطبیق داده‌شده</h4>
                    {b.terms.accessories.map((a) => (
                      <label className="checkbox-line" key={a}>
                        <input
                          type="checkbox"
                          checked={checked.includes(a)}
                          onChange={(e) =>
                            setChecked(e.target.checked ? [...checked, a] : checked.filter((x) => x !== a))
                          }
                        />
                        {a}
                      </label>
                    ))}
                    <ul className="prep-list">
                      {preparationChecklist.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                    <label className="checkbox-line">
                      <input
                        type="checkbox"
                        checked={prepared}
                        onChange={(e) => setPrepared(e.target.checked)}
                      />
                      <span>آماده‌سازی اطلاعات و حساب‌ها را بررسی و مغایرت‌ها را در گزارش ثبت کردم.</span>
                    </label>
                    <div className="button-row">
                      <button
                        className="btn primary"
                        disabled={busy === b.id}
                        onClick={() => void transition(b.id, reportFor.status)}
                      >
                        ذخیرهٔ گزارش و وضعیت
                      </button>
                      <button className="btn secondary" onClick={() => setReportFor(null)}>
                        انصراف
                      </button>
                    </div>
                  </div>
                )}
                <div className="booking-actions">
                  {(["accepted", "rejected", "handed_over", "completed", "cancelled"] as BookingStatus[])
                    .filter((s) => canTransition(b.status, s, role))
                    .map((s) => (
                      <button
                        className={`btn ${s === "accepted" || s === "handed_over" || s === "completed" ? "primary" : "secondary"} small`}
                        key={s}
                        disabled={busy === b.id}
                        onClick={() => {
                          if (s === "handed_over" || s === "completed") {
                            setReportFor({ id: b.id, status: s });
                            setChecked([]);
                            setCondition("");
                            setPrepared(false);
                          } else void transition(b.id, s);
                        }}
                      >
                        {busy === b.id ? "در حال ذخیره…" : labels[s]}
                      </button>
                    ))}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
type Insight = {
  events: { kind: string; count: number }[];
  sales: { requests: number; requested: number; accepted: number; completed: number; commission: number };
  mode: string;
  payments: string;
};
export function InsightsPage() {
  const app = useApp(),
    [data, setData] = useState<Insight | null>(null);
  useEffect(() => {
    api<Insight>("insights")
      .then(setData)
      .catch((e) => app.setError(e.message));
  }, [app.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!data) return <Loading />;
  const eventLabels: Record<string, string> = {
    search: "جست‌وجو",
    listing_view: "مشاهدهٔ آگهی",
    comparison: "مقایسه",
    booking_requested: "درخواست اجاره",
    booking_accepted: "پذیرش مالک",
    booking_rejected: "رد درخواست",
    booking_handed_over: "تحویل دستگاه",
    booking_completed: "اجارهٔ تکمیل‌شده",
    booking_cancelled: "لغو",
    booking_expired: "انقضا",
    owner_activated: "اولین انتشار مالک",
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">فعالیت ثبت‌شده</div>
          <h1>مسیر این {data.mode === "real" ? "حساب" : "دمو"}، در داده‌ها</h1>
          <p>این اعداد از رویدادهای ذخیره‌شدهٔ همین تجربه خوانده می‌شوند.</p>
        </div>
        <BarChart3 size={38} />
      </div>
      <Notice tone="warning">
        <b>مالی شبیه‌سازی‌شده · فروش واقعی نیست.</b> ارزش اجاره، درآمد پلتفرم نیست. ودیعه در ارزش اجاره و
        کمیسیون محاسبه نمی‌شود.
      </Notice>
      <div className="stat-grid">
        {[
          ["ارزش درخواست‌ها", data.sales.requested],
          ["ارزش درخواست‌های پذیرفته‌شده", data.sales.accepted],
          ["GMV اجاره‌های تکمیل‌شده", data.sales.completed],
          ["کمیسیون تخمینی تکمیل‌شده", data.sales.commission],
        ].map(([label, n]) => (
          <div className="stat-card" key={label as string}>
            <span>{label as string}</span>
            <strong>{money(Number(n))}</strong>
            <small>شبیه‌سازی · تومان</small>
          </div>
        ))}
      </div>
      <section className="editor-section">
        <h2>رویدادهای این تجربه</h2>
        <p>شمارش رویدادهاست؛ این نمودار به‌عنوان نرخ تبدیل ارائه نمی‌شود.</p>
        {data.events.length ? (
          <div className="event-bars">
            {data.events.map((e) => (
              <div key={e.kind}>
                <span>{eventLabels[e.kind] || e.kind}</span>
                <div>
                  <span
                    style={{
                      width: `${Math.max(2, (e.count / Math.max(...data.events.map((x) => x.count))) * 100)}%`,
                    }}
                  />
                </div>
                <b>{fa(e.count)}</b>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">
            <Search size={30} />
            <p>هنوز رویدادی ثبت نشده است.</p>
          </div>
        )}
      </section>
      <div className="real-payments">
        <span>
          وجوه دریافتی واقعی: <b>در دسترس نیست</b>
        </span>
        <span>
          بازپرداخت واقعی: <b>در دسترس نیست</b>
        </span>
      </div>
      <div className="dashboard-links">
        <h2>داشبوردهای فنی و کسب‌وکار</h2>
        <p>دسترسی به Grafana نیازمند حساب مجاز است. داده‌های دمو، آزمون و حساب‌های واقعی جدا هستند.</p>
        {[
          ["torob-health", "سلامت برنامه"],
          ["torob-product", "مسیر محصول"],
          ["torob-economics", "اقتصاد بازار · شبیه‌سازی"],
        ].map(([uid, title]) => (
          <a
            key={uid}
            href={`https://grafana.foroush-yar.ir/d/${uid}`}
            target="_blank"
            rel="noreferrer"
            className="btn secondary"
          >
            {title}
            <ExternalLink size={15} />
          </a>
        ))}
      </div>
    </>
  );
}
export function AccountPage() {
  const app = useApp(),
    router = useRouter(),
    [isRegister, setIsRegister] = useState(false),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api<{ user: User }>("auth", {
        action: isRegister ? "register" : "login",
        email,
        password,
        ...(isRegister ? { name } : {}),
      });
      app.setUser(r.user);
      app.clearCompare();
      router.push("/");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">حساب و دمو</div>
          <h1>تجربهٔ اجاره را از هر دو سمت ببین.</h1>
          <p>دموی شخصی برای بررسی محصول است؛ آگهی‌ها و معامله‌ها ساختگی‌اند.</p>
        </div>
      </div>
      <div className="account-layout">
        <section className="editor-section">
          <h2>
            <FlaskConical size={23} />
            دموی شخصی شما
          </h2>
          <p>
            اکنون: {app.user?.name || "وارد نشده"} ·{" "}
            {app.user?.mode === "real" ? "حساب شخصی" : "دموی جداگانه"}
          </p>
          <ol className="demo-steps">
            <li>در نقش مالک، یک آگهی بساز و مشخصات را از توضیح استخراج کن.</li>
            <li>به نقش اجاره‌کننده برو؛ نیازت را بنویس و فیلترها را تأیید کن.</li>
            <li>تا سه پیشنهاد را مقایسه کن و یک درخواست بفرست.</li>
            <li>به نقش مالک برگرد و درخواست را بپذیر.</li>
            <li>گزارش تحویل و بازگشت را ثبت کن و رویدادها را ببین.</li>
          </ol>
          <div className="button-row">
            <button
              className="btn primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await app.startDemo();
                  router.push("/");
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              شروع یک دموی تازه
              <ArrowLeft size={17} />
            </button>
            <Link href="/insights" className="btn secondary">
              فعالیت این دمو
            </Link>
          </div>
          <small>
            دموی تازه داده‌های بازدیدکنندگان دیگر را تغییر نمی‌دهد. نشست قبلی این مرورگر جایگزین می‌شود.
          </small>
        </section>
        <section className="editor-section">
          <h2>
            <UserRound size={23} />
            {isRegister ? "ساخت حساب شخصی" : "ورود به حساب شخصی"}
          </h2>
          <p>
            ایمیل برای ورود است؛ تأیید هویت یا بازیابی رمز در این نسخه ارائه نمی‌شود. پرداخت واقعی همچنان
            غیرفعال است.
          </p>
          <form onSubmit={submit}>
            {isRegister && (
              <Field label="نام">
                <input
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={2}
                />
              </Field>
            )}
            <Field label="ایمیل">
              <input
                type="email"
                autoComplete="email"
                dir="ltr"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="رمز عبور" hint="حداقل ۱۲ نویسه">
              <input
                type="password"
                autoComplete={isRegister ? "new-password" : "current-password"}
                dir="ltr"
                minLength={12}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            {error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
            <button className="btn ink full" disabled={busy}>
              <LogIn size={18} />
              {busy ? "در حال انجام…" : isRegister ? "ساخت حساب" : "ورود"}
            </button>
            <button type="button" className="text-button" onClick={() => setIsRegister(!isRegister)}>
              {isRegister ? "حساب دارم؛ ورود" : "حساب ندارم؛ ثبت‌نام"}
            </button>
          </form>
          {app.user && (
            <button
              className="text-button"
              onClick={async () => {
                await api("session", { action: "logout" });
                app.setUser(null);
                app.clearCompare();
              }}
            >
              خروج از نشست فعلی
            </button>
          )}
        </section>
      </div>
    </>
  );
}
