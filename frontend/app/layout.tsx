import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import "@fontsource/ibm-plex-sans-arabic/700.css";
import { signOut } from "@/app/actions";
import { SessionRefresh } from "@/components/session-refresh";
import { sessionTokens } from "@/lib/session";
import mardoodLogo from "../public/brand/mardood-logo.png";
import "./globals.css";

const brandName = "مردود";

export const metadata: Metadata = {
  title: { default: brandName, template: `%s | ${brandName}` },
  description: "عروض من متاجر السلمية تستخدمها عند الدفع نقداً في المتجر.",
  icons: { icon: { url: "/brand/mardood-symbol.png", type: "image/png", sizes: "512x512" } },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { accessToken, refreshToken } = await sessionTokens();
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen">
        {refreshToken && <SessionRefresh needsRefresh={!accessToken} />}
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-3 focus:z-10 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">
          انتقل إلى المحتوى
        </a>
        <header className="border-b border-rule bg-white">
          <div className="page-wrap flex min-h-18 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
            <Link href="/" aria-label={`${brandName}، الصفحة الرئيسية`} className="inline-flex min-h-11 shrink-0 items-center">
              <Image src={mardoodLogo} alt="" sizes="(min-width: 640px) 144px, 112px" className="h-auto w-28 sm:w-36" />
            </Link>
            <nav aria-label="التنقل الرئيسي" className="flex flex-wrap items-center gap-2 text-sm sm:gap-4 sm:text-base">
              {accessToken ? (
                <>
                  <Link href="/customer" className="inline-flex min-h-11 items-center rounded-lg px-2 font-semibold hover:bg-mauve sm:px-3">الكاش باك</Link>
                  <form action={signOut}><button className="button-secondary" type="submit">تسجيل الخروج</button></form>
                </>
              ) : <Link href="/login" className="button-secondary px-3 sm:px-4">تسجيل الدخول</Link>}
            </nav>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>{children}</main>
      </body>
    </html>
  );
}
