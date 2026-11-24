"use client";

import { useI18n } from "@/components/i18n-provider";
import Link from "@/components/localized-link";
import { usePathname } from "next/navigation";
import { Suspense, useRef, type ReactNode } from "react";
import { LanguageSwitcher } from "./language-switcher";
import { splitLocale } from "@/lib/locale";

const homeLinks = [
  { href: "/", label: "navigation.home2" },
  { href: "/#how-it-works", label: "home.howMardoodWorks" },
  { href: "/#benefits", label: "navigation.mardoodBenefits" },
  { href: "/#faq", label: "home.frequentlyAskedQuestions" },
  { href: "/about", label: "navigation.aboutUs" },
] as const;

export function HomeNavigation({ children, signedIn, hasSession }: {
  children: ReactNode;
  signedIn: boolean;
  hasSession: boolean;
}) {
  const { t } = useI18n();
  const pathname = splitLocale(usePathname() ?? "/").pathname;
  const menu = useRef<HTMLDetailsElement>(null);
  const language = <Suspense><LanguageSwitcher /></Suspense>;
  if (pathname === "/login" || pathname === "/register") {
    return (
      <div className="flex items-center gap-2">
        {signedIn && (
          <nav aria-label={t("navigation.mainNavigation")}>
            <Link href="/" className="button-secondary px-3 sm:px-4">{t("navigation.home2")}</Link>
          </nav>
        )}
        {language}
      </div>
    );
  }
  const isHome = pathname === "/";
  const menuVisibility = hasSession ? "" : isHome ? "lg:hidden" : "sm:hidden";

  return (
    <>
      {isHome && <nav aria-label={t("navigation.mardoodPages")} className="hidden items-center gap-0.5 lg:flex xl:gap-2">
        {homeLinks.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            aria-current={href === "/" ? "page" : undefined}
            className="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-semibold whitespace-nowrap text-muted decoration-2 underline-offset-8 hover:bg-mauve/60 hover:text-ink aria-[current=page]:text-action-hover aria-[current=page]:underline"
          >
            {t(label)}
          </Link>
        ))}
      </nav>}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {!hasSession && children}
        <div className="hidden sm:block">{language}</div>
        <details
          ref={menu}
          className={`group relative ${menuVisibility}`}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
          }}
          onKeyDown={(event) => {
            if (event.key !== "Escape" || !event.currentTarget.open) return;
            event.preventDefault();
            event.currentTarget.open = false;
            event.currentTarget.querySelector("summary")?.focus();
          }}
        >
          <summary aria-controls="header-menu" className="inline-flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center gap-2 rounded-lg border border-rule px-3 text-sm font-semibold text-ink hover:bg-mauve group-open:bg-mauve [&::-webkit-details-marker]:hidden">
            <span aria-hidden="true" className="relative h-0.5 w-4 rounded-full bg-current before:absolute before:inset-x-0 before:-top-1.5 before:h-0.5 before:rounded-full before:bg-current after:absolute after:inset-x-0 after:top-1.5 after:h-0.5 after:rounded-full after:bg-current" />
            <span className="sr-only sm:not-sr-only">{t("navigation.menu")}</span>
          </summary>
          <div
            id="header-menu"
            className="surface absolute end-0 top-full z-20 mt-2 grid max-h-[calc(100dvh-5rem)] w-60 max-w-[calc(100vw-2rem)] gap-1 overflow-y-auto p-2"
            onClick={(event) => {
              if (event.target instanceof Element && event.target.closest("a[href]") && menu.current) {
                menu.current.open = false;
              }
            }}
          >
            {hasSession && children}
            {isHome && (
              <nav aria-label={t("navigation.mardoodPages")} className="grid lg:hidden">
                {homeLinks.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    aria-current={href === "/" ? "page" : undefined}
                    className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold hover:bg-mauve aria-[current=page]:bg-mauve"
                  >
                    {t(label)}
                  </Link>
                ))}
              </nav>
            )}
            <div className={`px-2 sm:hidden ${isHome || hasSession ? "border-t border-rule pt-2" : ""}`}>{language}</div>
          </div>
        </details>
      </div>
    </>
  );
}
