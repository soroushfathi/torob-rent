"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRightLeft,
  FlaskConical,
  Plus,
  Search,
  UserRound,
  X,
  ChartNoAxesCombined,
  Menu,
  SlidersHorizontal,
} from "lucide-react";
import { api, useApp, type User } from "./provider";
import { SearchPage } from "./search";
import { ListingPage, ComparisonPage } from "./listing";
import { OwnerPage, EditorPage } from "./owner";
import { BookingsPage, InsightsPage, AccountPage } from "./bookings";
import { Loading } from "./ui";
import { fa } from "@/lib/domain";
export function Marketplace() {
  const pathname = usePathname(),
    router = useRouter(),
    app = useApp();
  const [switching, setSwitching] = useState(false),
    [menu, setMenu] = useState(false);
  async function switchRole() {
    setSwitching(true);
    try {
      const role = app.user?.role === "owner" ? "renter" : "owner";
      const r = await api<{ user: User }>("session", { action: "switch", role });
      app.setUser(r.user);
      router.push(role === "owner" ? "/owner" : "/");
    } catch (e) {
      app.setError((e as Error).message);
    } finally {
      setSwitching(false);
    }
  }
  const isOwner = pathname.startsWith("/owner");
  return (
    <>
      <a href="#main" className="skip-link">
        رفتن به محتوای اصلی
      </a>
      <div className="prototype-bar">
        <div className="container">
          <span>
            <FlaskConical size={14} />
            نمونهٔ مستقل چالش استخدامی · وابسته به ترب نیست
          </span>
          <span>پرداخت‌ها شبیه‌سازی‌شده‌اند؛ پولی دریافت نمی‌شود.</span>
        </div>
      </div>
      <header className="header">
        <div className="container header-inner">
          <Link href="/" className="brand" aria-label="ترب اجاره، صفحهٔ اصلی">
            <span className="brand-mark">
              ترب
              <span />
            </span>
            <span className="brand-divider" />
            <span className="brand-sub">
              اجاره<small>TOROB RENT</small>
            </span>
          </Link>
          <nav className={menu ? "open" : ""} aria-label="ناوبری اصلی">
            <Link
              className={pathname === "/" || pathname.startsWith("/listings") ? "active" : ""}
              href="/"
              onClick={() => setMenu(false)}
            >
              <Search size={17} />
              پیدا کردن مک‌بوک
            </Link>
            <Link
              className={pathname === "/bookings" ? "active" : ""}
              href="/bookings"
              onClick={() => setMenu(false)}
            >
              درخواست‌های من
            </Link>
            <Link className={isOwner ? "active" : ""} href="/owner" onClick={() => setMenu(false)}>
              پنل مالک
            </Link>
          </nav>
          <div className="header-actions">
            <Link className="btn primary small" href="/owner/new">
              <Plus size={17} />
              ثبت آگهی
            </Link>
            <Link className="avatar" href="/account" aria-label="حساب کاربری">
              <UserRound size={20} />
            </Link>
            <button className="mobile-menu icon-button" onClick={() => setMenu(!menu)} aria-label="فهرست">
              <Menu size={23} />
            </button>
          </div>
        </div>
      </header>
      <div className="container">
        <div className="demo-strip">
          <span className="demo-info">
            <span className="demo-badge">{app.user?.mode === "real" ? "حساب شخصی" : "دموی شخصی"}</span>
            {app.user?.mode === "real"
              ? "پرداخت واقعی غیرفعال است؛ احراز هویت انجام نمی‌شود."
              : "۱۲ آگهی ساختگی، مخصوص تجربهٔ شما. تغییرات دیگران وارد دموی شما نمی‌شود."}
          </span>
          {app.user?.mode !== "real" && (
            <button className="role-button" onClick={switchRole} disabled={!app.user || switching}>
              <ArrowRightLeft size={15} />
              {switching
                ? "در حال تغییر…"
                : app.user?.role === "owner"
                  ? "رفتن به نقش اجاره‌کننده"
                  : "امتحان نقش مالک"}
            </button>
          )}
        </div>
      </div>
      {app.error && (
        <div className="toast" role="alert">
          <span>{app.error}</span>
          <button className="icon-button" onClick={() => app.setError("")} aria-label="بستن پیام">
            <X size={17} />
          </button>
        </div>
      )}
      <main className="container main" id="main">
        {!app.ready ? (
          <Loading text="در حال آماده‌سازی دموی شخصی شما…" />
        ) : !app.user && pathname !== "/account" ? (
          <div className="empty">
            <h1>دموی شخصی را شروع کنید</h1>
            <p>داده‌ها و تغییرات این دمو فقط برای شما خواهند بود.</p>
            <button
              className="btn primary"
              onClick={() => app.startDemo().catch((e) => app.setError(e.message))}
            >
              شروع دمو
            </button>
          </div>
        ) : pathname === "/" || pathname === "/search" ? (
          <SearchPage />
        ) : pathname.startsWith("/listings/") ? (
          <ListingPage id={pathname.split("/")[2]} />
        ) : pathname === "/compare" ? (
          <ComparisonPage />
        ) : pathname === "/owner/new" ? (
          <EditorPage />
        ) : pathname.startsWith("/owner/edit/") ? (
          <EditorPage id={pathname.split("/")[3]} />
        ) : pathname === "/owner" ? (
          <OwnerPage />
        ) : pathname === "/bookings" || pathname === "/owner/requests" ? (
          <BookingsPage />
        ) : pathname === "/insights" ? (
          <InsightsPage />
        ) : pathname === "/account" ? (
          <AccountPage />
        ) : (
          <div className="empty">
            <h1>صفحه پیدا نشد</h1>
            <Link href="/" className="btn primary">
              بازگشت به جست‌وجو
            </Link>
          </div>
        )}
      </main>
      <footer className="container footer">
        <div>
          <b>ترب اجاره</b>
          <span>مک‌بوک برای یک پروژه، نه یک عمر.</span>
        </div>
        <p>موجودی دمو فرضی است. هیچ بیمه، احراز هویت یا پرداخت امانی ارائه نمی‌شود.</p>
        <Link href="/insights">
          <ChartNoAxesCombined size={16} />
          فعالیت دموی من
        </Link>
        <Link href="/account">
          <SlidersHorizontal size={16} />
          حساب و راهنمای دمو
        </Link>
      </footer>
      {app.compare.length > 0 && pathname !== "/compare" && (
        <div className="compare-tray">
          <div>
            <span className="compare-count">{fa(app.compare.length)}</span>
            <span>
              مک‌بوک برای مقایسه<small>قیمت اجاره، ودیعه و شرایط، کنار هم</small>
            </span>
          </div>
          <div>
            <button className="icon-button" onClick={app.clearCompare} aria-label="پاک کردن مقایسه">
              <X size={18} />
            </button>
            <Link className="btn primary" href="/compare">
              مقایسهٔ پیشنهادها
              <ArrowLeft size={17} />
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
