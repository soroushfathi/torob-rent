"use client";
import type { ReactNode } from "react";
import { MapPin, Check, Plus, ArrowUpLeft, HardDrive, MemoryStick } from "lucide-react";
import Link from "next/link";
import { fa, money, persianDate, rentalDays, type Listing, type Requirements } from "@/lib/domain";
import { useApp } from "./provider";
export function IconLabel({ children, icon }: { children: ReactNode; icon: ReactNode }) {
  return (
    <span className="icon-label">
      {icon}
      {children}
    </span>
  );
}
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export { DateField } from "./jalali-date-field";
export function Price({ listing, requirements }: { listing: Listing; requirements: Requirements }) {
  let days = 3;
  try {
    days = rentalDays(requirements.startDate, requirements.endDate);
  } catch {}
  return (
    <>
      <div className="price-line">
        <span>اجارهٔ {fa(days)} روز</span>
        <strong>{money(listing.dailyPrice * days)}</strong>
      </div>
      <div className="price-line deposit">
        <span>ودیعهٔ بازگشت‌پذیر</span>
        <b>{money(listing.deposit)}</b>
      </div>
    </>
  );
}
export function ListingCard({ listing }: { listing: Listing }) {
  const { compare, toggleCompare, requirements } = useApp();
  const selected = compare.includes(listing.id);
  return (
    <article className={`listing-card ${selected ? "selected" : ""}`}>
      <Link href={`/listings/${listing.id}`} className="card-photo">
        <img
          src={listing.photos[0] || "/images/macbook-pro.jpg"}
          alt={listing.synthetic ? "عکس نمونهٔ مک‌بوک؛ تصویر دستگاه واقعی نیست" : listing.title}
          loading="lazy"
        />
        <span className="photo-label">{listing.synthetic ? "آگهی و عکس نمونه" : "عکس مالک"}</span>
        <span className="availability">
          <span />
          آزاد در این بازه
        </span>
      </Link>
      <div className="card-content">
        <IconLabel icon={<MapPin size={14} />}>{listing.neighborhood}، تهران</IconLabel>
        <Link href={`/listings/${listing.id}`} className="card-title" dir="ltr">
          {listing.title}
        </Link>
        <div className="specs">
          <span>{listing.chip || "تراشه نامشخص"}</span>
          <span>
            <MemoryStick size={13} />
            {listing.ram ? `${fa(listing.ram)} GB` : "رم نامشخص"}
          </span>
          <span>
            <HardDrive size={13} />
            {listing.storage ? `${fa(listing.storage)} GB` : "نامشخص"}
          </span>
        </div>
        <div className="card-pricing">
          <Price listing={listing} requirements={requirements} />
        </div>
        <div className="card-bottom">
          <button
            className={`compare-button ${selected ? "is-selected" : ""}`}
            onClick={() => toggleCompare(listing.id)}
            aria-pressed={selected}
            aria-label={`مقایسه ${listing.title}`}
          >
            {selected ? <Check size={16} /> : <Plus size={16} />}مقایسه
          </button>
          <Link className="text-link" href={`/listings/${listing.id}`}>
            جزئیات و درخواست
            <ArrowUpLeft size={16} />
          </Link>
        </div>
      </div>
    </article>
  );
}
export function Loading({ text = "در حال دریافت اطلاعات…" }: { text?: string }) {
  return (
    <div className="loading" role="status">
      <span className="spinner" />
      {text}
    </div>
  );
}
export function SkeletonCards() {
  return (
    <div className="cards" role="status" aria-label="در حال بارگذاری آگهی‌ها">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div className="skeleton-card" key={i}>
          <div />
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}
export function Notice({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "success" | "warning";
}) {
  return <div className={`notice ${tone}`}>{children}</div>;
}
export function DateRange({ start, end }: { start: string; end: string }) {
  return (
    <span>
      {persianDate(start, true)} تا {persianDate(end, true)}
    </span>
  );
}
