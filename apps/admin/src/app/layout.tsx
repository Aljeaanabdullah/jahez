import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import { getPrefs } from "@/lib/prefs";
import "./globals.css";

const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-plex-arabic",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Jahez — لوحة التحكم",
  description: "نظام تحضير الموظفين",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { lang, dir, theme } = await getPrefs();
  return (
    <html
      lang={lang}
      dir={dir}
      className={`${plexArabic.variable} ${theme === "dark" ? "dark" : ""} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
