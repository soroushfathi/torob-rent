"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="empty">
      <h1>این صفحه باز نشد</h1>
      <p>دوباره تلاش کنید؛ درخواست‌های ثبت‌شده محفوظ‌اند.</p>
      <button onClick={reset} className="btn primary">
        تلاش دوباره
      </button>
    </main>
  );
}
