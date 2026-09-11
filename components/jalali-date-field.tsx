"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { jalaaliMonthLength, toGregorian, toJalaali } from "jalaali-js";
import { addDays, fa, normalizeDate, persianDate, todayTehran } from "@/lib/domain";

const months = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];
const weekdays = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
function jalali(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return toJalaali(year, month, day);
}
function gregorian(year: number, month: number, day: number) {
  const g = toGregorian(year, month, day);
  return `${g.gy}-${String(g.gm).padStart(2, "0")}-${String(g.gd).padStart(2, "0")}`;
}

export function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [raw, setRaw] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => jalali(normalizeDate(value) || todayTehran()));
  const today = todayTehran();
  const validValue = normalizeDate(value);
  const formatted = validValue
    ? (() => {
        const d = jalali(validValue);
        return `${fa(d.jy).replace(/٬/g, "")}/${String(d.jm)
          .padStart(2, "0")
          .replace(/\d/g, (x) => "۰۱۲۳۴۵۶۷۸۹"[Number(x)])}/${String(d.jd)
          .padStart(2, "0")
          .replace(/\d/g, (x) => "۰۱۲۳۴۵۶۷۸۹"[Number(x)])}`;
      })()
    : "";
  const first = gregorian(month.jy, month.jm, 1);
  const offset = (new Date(`${first}T12:00:00Z`).getUTCDay() + 1) % 7;
  const days = jalaaliMonthLength(month.jy, month.jm);
  const selectedJalali = validValue ? jalali(validValue) : null;
  const selectedInMonth = selectedJalali?.jy === month.jy && selectedJalali?.jm === month.jm;
  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  function choose(date: string) {
    onChange(date);
    setRaw(null);
    close();
  }
  function moveMonth(delta: number) {
    const index = month.jy * 12 + month.jm - 1 + delta;
    setMonth({ jy: Math.floor(index / 12), jm: (((index % 12) + 12) % 12) + 1, jd: 1 });
  }
  useEffect(() => {
    if (!open) return;
    const outside = (e: Event) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    root.current
      ?.querySelector<HTMLButtonElement>(".jalali-day[aria-pressed=true], .jalali-day[tabindex='0']")
      ?.focus();
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
    };
  }, [open]);
  return (
    <div className="field jalali-field" ref={root}>
      <label id={`${id}-label`} htmlFor={id}>
        {label}
      </label>
      <div className="date-input">
        <input
          id={id}
          value={raw ?? formatted}
          aria-invalid={raw !== null && !normalizeDate(raw)}
          placeholder="۱۴۰۵/۰۶/۲۱"
          inputMode="numeric"
          onChange={(e) => setRaw(e.target.value)}
          onBlur={() => {
            if (raw !== null) {
              const date = normalizeDate(raw);
              onChange(date);
              if (date) setRaw(null);
            }
          }}
        />
        <button
          type="button"
          ref={trigger}
          className="jalali-trigger"
          aria-label={`تقویم ${label}`}
          aria-expanded={open}
          aria-controls={`${id}-calendar`}
          aria-haspopup="dialog"
          onClick={() => {
            if (!open) setMonth(jalali(validValue || today));
            setOpen(!open);
          }}
        >
          <CalendarDays size={18} />
        </button>
      </div>
      <small>ساعت ۱۲ ظهر · تهران</small>
      {raw !== null && !normalizeDate(raw) && <small className="red-text">تاریخ معتبر وارد کنید.</small>}
      {open && (
        <div
          id={`${id}-calendar`}
          className="jalali-calendar"
          role="dialog"
          aria-label={`انتخاب شمسی ${label}`}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              close();
            }
          }}
        >
          <div className="jalali-heading">
            <button type="button" aria-label="ماه قبل" onClick={() => moveMonth(-1)}>
              <ChevronRight size={18} />
            </button>
            <strong aria-live="polite">
              {months[month.jm - 1]} {fa(month.jy).replace(/٬/g, "")}
            </strong>
            <button type="button" aria-label="ماه بعد" onClick={() => moveMonth(1)}>
              <ChevronLeft size={18} />
            </button>
            <button type="button" aria-label="بستن تقویم" onClick={close}>
              <X size={16} />
            </button>
          </div>
          <div className="jalali-weekdays">
            {weekdays.map((day, i) => (
              <span key={day} title={day}>
                {["ش", "ی", "د", "س", "چ", "پ", "ج"][i]}
              </span>
            ))}
          </div>
          <div className="jalali-days">
            {Array.from({ length: offset }, (_, i) => (
              <span key={`space-${i}`} />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const date = gregorian(month.jy, month.jm, i + 1);
              const selected = date === validValue;
              return (
                <button
                  type="button"
                  key={date}
                  data-date={date}
                  className={`jalali-day${date === today ? " today" : ""}`}
                  aria-label={persianDate(date)}
                  aria-pressed={selected}
                  aria-current={date === today ? "date" : undefined}
                  tabIndex={selected || (i === 0 && !selectedInMonth) ? 0 : -1}
                  onClick={() => choose(date)}
                  onKeyDown={(e) => {
                    const delta = { ArrowLeft: 1, ArrowRight: -1, ArrowDown: 7, ArrowUp: -7 }[e.key];
                    if (delta !== undefined) {
                      e.preventDefault();
                      const next = addDays(date, delta);
                      setMonth(jalali(next));
                      requestAnimationFrame(() =>
                        root.current?.querySelector<HTMLButtonElement>(`[data-date="${next}"]`)?.focus(),
                      );
                    }
                  }}
                >
                  {fa(i + 1)}
                </button>
              );
            })}
          </div>
          <div className="jalali-footer">
            <button type="button" onClick={() => choose(today)}>
              امروز
            </button>
            <button type="button" onClick={() => choose("")}>
              پاک کردن
            </button>
            <span>تقویم هجری شمسی</span>
          </div>
        </div>
      )}
    </div>
  );
}
