"use client";

import { useI18n } from "@/components/i18n-provider";
import Link from "@/components/localized-link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { LanguageSwitcher } from "./language-switcher";
import { splitLocale } from "@/lib/locale";

const homeLinks = [
  { href: "/", label: "navigation.home2" },
  { href: "/#how-it-works", label: "home.howMardoodWorks" },
  { href: "/#benefits", label: "navigation.mardoodBenefits" },
  { href: "/#faq", label: "home.frequentlyAskedQuestions" },
  { href: "/about", label: "navigation.aboutUs" },
] as const;

export function HomeNavigation({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const pathname = splitLocale(usePathname() ?? "/").pathname;
  const language = <Suspense><LanguageSwitcher /></Suspense>;
  if (pathname === "/login" || pathname === "/register") {
    return (
      <div className="flex items-center gap-2">
        <nav aria-label={t("navigation.mainNavigation")}>
          <Link href="/" className="button-secondary px-3 sm:px-4">{t("navigation.home2")}</Link>
        </nav>
        {language}
      </div>
    );
  }
  if (pathname !== "/") return <div className="flex flex-wrap items-center gap-2">{children}{language}</div>;

  return (
    <>
      <nav aria-label={t("navigation.mardoodPages")} className="home-navigation hidden items-center gap-1 lg:flex xl:gap-3">
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
      </nav>
      <div className="home-navigation flex items-center gap-2">
        {children}
        <div className="hidden lg:block">{language}</div>
        <details
          className="group relative lg:hidden"
          onKeyDown={(event) => {
            if (event.key !== "Escape" || !event.currentTarget.open) return;
            event.currentTarget.open = false;
            event.currentTarget.querySelector("summary")?.focus();
          }}
        >
          <summary aria-controls="home-mobile-links" className="grid size-11 cursor-pointer list-none place-items-center rounded-lg border border-rule text-ink hover:bg-mauve group-open:bg-mauve [&::-webkit-details-marker]:hidden">
            <span className="sr-only">{t("navigation.mardoodPagesMenu")}</span>
            <span aria-hidden="true" className="relative h-0.5 w-4 rounded-full bg-current before:absolute before:inset-x-0 before:-top-1.5 before:h-0.5 before:rounded-full before:bg-current after:absolute after:inset-x-0 after:top-1.5 after:h-0.5 after:rounded-full after:bg-current" />
          </summary>
          <nav id="home-mobile-links" aria-label={t("navigation.mardoodPages")} className="surface absolute end-0 top-full z-20 mt-2 grid w-56 max-w-[calc(100vw-2rem)] gap-0.5 p-2 shadow-sm shadow-ink/10">
            {homeLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={href === "/" ? "page" : undefined}
                onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")}
                className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold hover:bg-mauve aria-[current=page]:text-action-hover"
              >
                {t(label)}
              </Link>
            ))}
            <div className="mt-1 border-t border-rule p-2">{language}</div>
          </nav>
        </details>
      </div>
    </>
  );
}
