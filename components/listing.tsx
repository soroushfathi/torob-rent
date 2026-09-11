"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Info,
  MapPin,
  ShieldCheck,
  Sparkles,
  Plus,
  X,
  ArrowLeft,
  CalendarCheck,
  PackageCheck,
} from "lucide-react";
import { api, useApp } from "./provider";
import { DateField, DateRange, Loading, Notice, Price } from "./ui";
import { money, fa, persianDate, quote, suitability, preparationChecklist, type Listing } from "@/lib/domain";
export function ListingPage({ id }: { id: string }) {
  const app = useApp(),
    router = useRouter(),
    [listing, setListing] = useState<Listing | null>(null),
    [loading, setLoading] = useState(true),
    [booking, setBooking] = useState(false),
    [agreed, setAgreed] = useState(false),
    [photo, setPhoto] = useState(0),
    [error, setError] = useState("");
  const requestKey = useRef(crypto.randomUUID());
  useEffect(() => {
    let alive = true;
    setLoading(true);
    api<{ listing: Listing }>(`listings/${id}`)
      .then((r) => {
        if (alive) setListing(r.listing);
        return api("events", {
          kind: "listing_view",
          key: crypto.randomUUID(),
          entityId: id,
          searchId: app.searchId,
        });
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id, app.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (loading) return <Loading />;
  if (!listing)
    return (
      <div className="empty">
        <h1>آگهی در دسترس نیست</h1>
        <p>{error}</p>
        <Link href="/" className="btn primary">
          بازگشت به جست‌وجو
        </Link>
      </div>
    );
  let q: ReturnType<typeof quote> | null = null;
  try {
    q = quote(listing.dailyPrice, listing.deposit, app.requirements.startDate, app.requirements.endDate);
  } catch {}
  const s = suitability(listing, app.requirements),
    own = listing.ownerId === app.user?.id;
  async function request() {
    setBooking(true);
    setError("");
    try {
      await api("bookings", {
        listingId: id,
        startDate: app.requirements.startDate,
        endDate: app.requirements.endDate,
        requestKey: requestKey.current,
        searchId: app.searchId,
      });
      router.push("/bookings");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBooking(false);
    }
  }
  return (
    <>
      <div className="breadcrumb">
        <Link href="/">
          <ArrowRight size={15} />
          مک‌بوک‌های تهران
        </Link>
        <span>/</span>
        <span>{listing.neighborhood}</span>
      </div>
      <div className="detail-layout">
        <div className="detail-main">
          <div className="detail-image">
            <img src={listing.photos[photo] || "/images/macbook-pro.jpg"} alt={listing.title} />
            <span className="photo-label">
              {listing.synthetic ? "عکس صرفاً نمونهٔ ظاهری است" : "عکس بارگذاری‌شدهٔ مالک"}
            </span>
          </div>
          {listing.photos.length > 1 && (
            <div className="thumbnails">
              {listing.photos.map((p, i) => (
                <button
                  key={p}
                  onClick={() => setPhoto(i)}
                  aria-label={`عکس ${fa(i + 1)}`}
                  className={photo === i ? "active" : ""}
                >
                  <img src={p} alt="" />
                </button>
              ))}
            </div>
          )}
          <div className="detail-title">
            <div>
              <div className="icon-label">
                <MapPin size={16} />
                {listing.neighborhood}، تهران{listing.synthetic && <span className="tag">آگهی ساختگی</span>}
              </div>
              <h1 dir="ltr">{listing.title}</h1>
            </div>
            <button
              className="btn secondary"
              onClick={() => app.toggleCompare(id)}
              aria-pressed={app.compare.includes(id)}
            >
              {app.compare.includes(id) ? <Check size={17} /> : <Plus size={17} />}مقایسه
            </button>
          </div>
          <div className="detail-specs">
            {[
              ["تراشه", listing.chip || "نامشخص"],
              ["حافظهٔ رم", listing.ram ? `${fa(listing.ram)} گیگابایت` : "نامشخص؛ از مالک بپرسید"],
              ["حافظهٔ داخلی", listing.storage ? `${fa(listing.storage)} گیگابایت` : "نامشخص"],
              [
                "وضعیت ظاهری",
                { excellent: "بسیار خوب", good: "خوب", fair: "دارای آثار استفاده" }[listing.condition],
              ],
            ].map(([label, val]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{val}</strong>
              </div>
            ))}
          </div>
          <section className="detail-section">
            <h2>
              <Sparkles size={21} />
              برای پروژهٔ شما چقدر مناسب است؟
            </h2>
            <p className="subtle">ارزیابی قاعده‌محور از مشخصات ثبت‌شده؛ بدون ادعای بنچمارک</p>
            <ul className="check-list">
              {s.reasons.map((r) => (
                <li key={r}>
                  <Info size={16} />
                  {r}
                </li>
              ))}
            </ul>
          </section>
          <section className="detail-section">
            <h2>دربارهٔ دستگاه</h2>
            <p className="preserve">{listing.description}</p>
            <div className="accessories">
              <h3>
                <PackageCheck size={19} />
                همراه دستگاه
              </h3>
              {listing.accessories.map((a) => (
                <span key={a}>
                  <Check size={14} />
                  {a}
                </span>
              ))}
            </div>
          </section>
          <section className="detail-section">
            <h2>
              <CalendarCheck size={21} />
              دسترس‌پذیری و شرایط
            </h2>
            <div className="terms-grid">
              <div>
                <span>بازهٔ قابل اجاره</span>
                <b>
                  <DateRange start={listing.availableFrom} end={listing.availableTo} />
                </b>
              </div>
              <div>
                <span>حداقل مدت اجاره</span>
                <b>{fa(listing.minDays)} روز</b>
              </div>
              <div>
                <span>دریافت و بازگشت</span>
                <b>ساعت ۱۲ ظهر، به وقت تهران</b>
              </div>
            </div>
            {listing.blocked.length > 0 && (
              <Notice tone="warning">
                بازه‌های غیرقابل اجاره:{" "}
                {listing.blocked.map((b) => (
                  <span key={b.start}>
                    {persianDate(b.start, true)} تا {persianDate(b.end, true)}{" "}
                  </span>
                ))}
              </Notice>
            )}
            <h3>شرایط ضمانت غیرنقدی</h3>
            <p>{listing.guarantee || "شرطی ثبت نشده؛ پیش از درخواست با مالک هماهنگ کنید."}</p>
            <p className="subtle">در این نمونه هیچ مدرک هویتی، وجه یا ضمانتی جمع‌آوری نمی‌شود.</p>
          </section>
          <section className="detail-section">
            <h2>
              <ShieldCheck size={21} />
              آماده‌سازی اطلاعات شخصی
            </h2>
            <ul className="check-list">
              {preparationChecklist.map((t) => (
                <li key={t}>
                  <Check size={16} />
                  {t}
                </li>
              ))}
            </ul>
          </section>
        </div>
        <aside className="booking-panel">
          <div className="booking-panel-heading">
            <span>اجارهٔ روزانه</span>
            <strong>{money(listing.dailyPrice)}</strong>
          </div>
          <DateField
            label="دریافت دستگاه"
            value={app.requirements.startDate}
            onChange={(v) => {
              app.setRequirements({ ...app.requirements, startDate: v });
              requestKey.current = crypto.randomUUID();
            }}
          />
          <DateField
            label="بازگشت دستگاه"
            value={app.requirements.endDate}
            onChange={(v) => {
              app.setRequirements({ ...app.requirements, endDate: v });
              requestKey.current = crypto.randomUUID();
            }}
          />
          <div className="quote-block">
            <Price listing={listing} requirements={app.requirements} />
            <div className="price-line">
              <span>کارمزد قابل پرداخت</span>
              <b>۰ تومان</b>
            </div>
          </div>
          <Notice tone="warning">
            <b>پرداخت شبیه‌سازی‌شده</b>
            <p>هیچ مبلغی دریافت نمی‌شود. ودیعه جزو هزینهٔ اجاره نیست.</p>
          </Notice>
          <label className="checkbox-line">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>قیمت و شرایط را خوانده‌ام و می‌دانم درخواست، پس از پذیرش مالک قطعی می‌شود.</span>
          </label>
          {error && (
            <p role="alert" className="inline-error">
              {error}
            </p>
          )}
          {own ? (
            <Link href={`/owner/edit/${id}`} className="btn primary full">
              ویرایش آگهی خودم
            </Link>
          ) : (
            <button
              disabled={!agreed || booking || !q}
              className="btn primary full"
              onClick={() => void request()}
            >
              {booking ? "در حال ثبت…" : "ارسال درخواست اجاره"}
              <ArrowLeft size={18} />
            </button>
          )}
          <div className="panel-note">
            <Info size={15} />
            دسترس‌پذیری هنگام درخواست و پذیرش، روی سرور بررسی می‌شود.
          </div>
        </aside>
      </div>
    </>
  );
}
export function ComparisonPage() {
  const app = useApp(),
    [items, setItems] = useState<Listing[]>([]),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all(app.compare.map((id) => api<{ listing: Listing }>(`listings/${id}`).then((r) => r.listing)))
      .then(async (ls) => {
        if (alive) setItems(ls);
        if (ls.length)
          await api("events", {
            kind: "comparison",
            key: crypto.randomUUID(),
            listingIds: ls.map((l) => l.id),
            searchId: app.searchId,
          });
      })
      .catch((e) => app.setError(e.message))
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [app.compare]); // eslint-disable-line react-hooks/exhaustive-deps
  if (loading) return <Loading />;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">انتخاب آگاهانه</div>
          <h1>پیشنهادها را کنار هم ببین.</h1>
          <p>هزینهٔ اجاره، ودیعه و ضمانت را جداگانه بسنج.</p>
        </div>
        <Link href="/" className="btn secondary">
          افزودن مک‌بوک
          <Plus size={17} />
        </Link>
      </div>
      {!items.length ? (
        <div className="empty">
          <h2>هنوز دستگاهی انتخاب نشده</h2>
          <p>از آگهی‌ها، تا سه مک‌بوک را به مقایسه اضافه کنید.</p>
          <Link href="/" className="btn primary">
            پیدا کردن مک‌بوک
          </Link>
        </div>
      ) : (
        <div className="comparison-scroll">
          <table className="comparison-table">
            <thead>
              <tr>
                <th>مشخصات و شرایط</th>
                {items.map((l) => (
                  <th key={l.id}>
                    <button
                      className="remove-compare icon-button"
                      onClick={() => app.toggleCompare(l.id)}
                      aria-label={`حذف ${l.title} از مقایسه`}
                    >
                      <X size={16} />
                    </button>
                    <img src={l.photos[0]} alt={l.title} />
                    <Link href={`/listings/${l.id}`} dir="ltr">
                      {l.title}
                    </Link>
                    <span>
                      {l.neighborhood} · {l.synthetic ? "آگهی نمونه" : "آگهی مالک"}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                [
                  "کل هزینهٔ اجاره",
                  (l: Listing) => {
                    try {
                      return money(
                        quote(l.dailyPrice, l.deposit, app.requirements.startDate, app.requirements.endDate)
                          .rental,
                      );
                    } catch {
                      return "تاریخ نامعتبر";
                    }
                  },
                ],
                ["ودیعهٔ بازگشت‌پذیر", (l: Listing) => money(l.deposit)],
                ["تراشه", (l: Listing) => l.chip || "نامشخص"],
                ["رم", (l: Listing) => (l.ram ? `${fa(l.ram)} گیگابایت` : "نامشخص؛ نیاز به سؤال")],
                ["حافظهٔ داخلی", (l: Listing) => (l.storage ? `${fa(l.storage)} گیگابایت` : "نامشخص")],
                ["حداقل مدت", (l: Listing) => `${fa(l.minDays)} روز`],
                ["لوازم همراه", (l: Listing) => l.accessories.join("، ")],
                ["ضمانت غیرنقدی", (l: Listing) => l.guarantee || "ثبت نشده"],
                ["تناسب با پروژه", (l: Listing) => suitability(l, app.requirements).reasons.join(" ")],
              ].map(([label, render]) => (
                <tr key={label as string}>
                  <th>{label as string}</th>
                  {items.map((l) => (
                    <td key={l.id}>{(render as (l: Listing) => string)(l)}</td>
                  ))}
                </tr>
              ))}
              <tr>
                <th>قدم بعدی</th>
                {items.map((l) => (
                  <td key={l.id}>
                    <Link href={`/listings/${l.id}`} className="btn primary full">
                      جزئیات و درخواست
                      <ArrowLeft size={15} />
                    </Link>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <Notice>
        آزاد بودن دستگاه در صفحهٔ درخواست و هنگام پذیرش مالک دوباره بررسی می‌شود. هیچ عملکرد، بیمه یا اصالت
        دستگاهی تضمین نشده است.
      </Notice>
    </>
  );
}
