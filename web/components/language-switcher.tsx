"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { localizedPath, splitLocale } from "@/lib/locale";
import { merchantVerificationStatuses } from "@/lib/staff-contract";
import { validReferral } from "@/lib/ui";
import { useI18n } from "./i18n-provider";

export const languageSwitchEvent = "mardood-language-switch";

export function LanguageSwitcher() {
  const { locale, t } = useI18n();
  const pathname = splitLocale(usePathname() ?? "/").pathname;
  const query = useSearchParams();
  const parameters = new URLSearchParams();
  const [offer, extraOffer] = query.getAll("offer");
  const [page, extraPage] = query.getAll("page");
  if (offer && extraOffer === undefined && validReferral(offer)) parameters.set("offer", offer);
  if (page && extraPage === undefined && /^[1-9][0-9]{0,7}$/.test(page)) parameters.set("page", page);
  if (query.get("expired") === "1") parameters.set("expired", "1");
  const [status, extraStatus] = query.getAll("status");
  if (pathname === "/admin/merchants" && extraStatus === undefined && merchantVerificationStatuses.some((value) => value === status)) {
    parameters.set("status", status);
  }
  const search = parameters.size ? `?${parameters}` : "";
  return (
    <nav aria-label={t("navigation.language")} className="inline-flex shrink-0 items-center rounded-lg border border-rule bg-white p-0.5 text-xs">
      {(["ar", "en"] as const).map((item) => {
        const title = t(item === "ar" ? "navigation.arabic" : "navigation.english");
        return item === locale ? (
          <span key={item} lang={item} aria-current="true" className="grid min-h-9 place-items-center rounded-md bg-mauve px-2 font-bold text-ink">{title}</span>
        ) : (
          <a key={item} lang={item} hrefLang={item} href={localizedPath(pathname + search, item, true)}
            onClick={(event) => {
              if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
                window.dispatchEvent(new CustomEvent(languageSwitchEvent, { detail: item }));
              }
            }}
            className="grid min-h-9 place-items-center rounded-md px-2 font-semibold text-muted hover:text-action hover:underline">{title}</a>
        );
      })}
    </nav>
  );
}
