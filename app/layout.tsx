import type { Metadata } from "next";
import "@fontsource/vazirmatn/400.css";
import "@fontsource/vazirmatn/500.css";
import "@fontsource/vazirmatn/600.css";
import "@fontsource/vazirmatn/700.css";
import "./globals.css";
import { AppProvider } from "@/components/provider";
export const metadata: Metadata = {
  title: "ترب اجاره | مک‌بوک برای پروژهٔ تو",
  description:
    "مقایسه و درخواست اجارهٔ مک‌بوک در تهران؛ نمونهٔ مستقل چالش استخدامی با موجودی و پرداخت شبیه‌سازی‌شده.",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
