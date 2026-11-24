import { getI18n, publicAlternates } from "@/lib/i18n-server";
import { isLocale } from "@/lib/locale";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "@/components/localized-link";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import "@fontsource/ibm-plex-sans-arabic/700.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans/700.css";
import { I18nProvider } from "@/components/i18n-provider";
import { signOut } from "@/app/actions";
import { HomeNavigation } from "@/components/home-navigation";
import { SessionRefresh, SessionSignOut } from "@/components/session-refresh";
import { SiteFooter } from "@/components/site-footer";

import mardoodLogo from "../../public/brand/mardood-logo.png";
import "../globals.css";
import { getAccount, sessionTokens } from "@/lib/session";
import { logoutScope } from "@/lib/session-logout";
import { discoverCampaignsPath } from "@/lib/marketer-campaigns";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  const brand = t("common.brand");
  return {
    title: { default: brand, template: `%s | ${brand}` },
    description: t("metadata.description"),
    icons: { icon: { url: "/brand/mardood-symbol.png", type: "image/png", sizes: "512x512" } },
    ...await publicAlternates(),
  };
}

export default async function RootLayout({ children, params }: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { t } = await getI18n();
  const { accessToken, refreshToken } = await sessionTokens();
  const account = accessToken ? await getAccount().catch(() => null) : null;
  const signOutForm = (account || refreshToken)
    ? <SessionSignOut signOutAction={signOut.bind(null, logoutScope({ accessToken, refreshToken }))} label={t("navigation.signOut")} />
    : null;
  const link = "inline-flex min-h-11 items-center rounded-md px-3 font-semibold hover:bg-mauve";
  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      <body className="flex min-h-screen flex-col">
        <I18nProvider locale={locale}>
        {refreshToken && <SessionRefresh needsRefresh={!account} />}
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-3 focus:z-10 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">
          {t("navigation.skipToContent")}
        </a>
        <header className="border-b-[3px] border-dusty-mauve bg-white">
          <div className="page-wrap flex min-h-14 items-center justify-between gap-2 py-1.5">
            <Link href="/" aria-label={t("navigation.home", { value0: t("common.brand") })} className="inline-flex min-h-11 shrink-0 items-center">
              <Image src={mardoodLogo} alt="" sizes="(min-width: 640px) 112px, 88px" className="h-auto w-22 sm:w-28" />
            </Link>
            <HomeNavigation signedIn={Boolean(account)} hasSession={Boolean(signOutForm)}>
              <nav aria-label={t("navigation.mainNavigation")} className="grid gap-0.5 text-sm [&_form>button]:w-full">
                {account ? (
                  <>
                    {account.roles.includes("customer") && <Link href="/customer" className={link}>{t("common.cashback")}</Link>}
                    {account.roles.includes("merchant") && <Link href="/merchant" className={link}>{t("navigation.merchantDashboard")}</Link>}
                    {account.roles.includes("marketer") && <Link href={discoverCampaignsPath} className={link}>{t("marketerCampaigns.discover")}</Link>}
                    {account.roles.includes("marketer") && <Link href="/marketer/earnings" className={link}>{t("earnings.marketerTitle")}</Link>}
                    {account.roles.includes("admin") && <Link href="/admin/revenue" className={link}>{t("navigation.admin")}</Link>}
                    {signOutForm}
                  </>
                ) : signOutForm ?? <Link href="/login" className="button-secondary header-action px-3 whitespace-nowrap sm:px-4">{t("common.signIn")}</Link>}
              </nav>
            </HomeNavigation>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="grow">{children}</main>
        <SiteFooter />
        </I18nProvider>
      </body>
    </html>
  );
}
