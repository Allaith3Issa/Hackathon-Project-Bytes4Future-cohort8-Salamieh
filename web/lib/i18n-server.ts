import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getI18nFor } from "./i18n";
import { defaultLocale, isLocale, localeCookie, localeHeader, localizedPath, pathnameHeader } from "./locale";

export const getI18n = cache(async () => {
  const header = (await headers()).get(localeHeader);
  if (isLocale(header)) return getI18nFor(header);
  const saved = (await cookies()).get(localeCookie)?.value;
  return getI18nFor(isLocale(saved) ? saved : defaultLocale);
});

export async function redirectLocalized(path: string): Promise<never> {
  redirect(localizedPath(path, (await getI18n()).locale));
}

export async function publicAlternates() {
  const request = await headers();
  const pathname = request.get(pathnameHeader);
  if (!pathname || !/^(?:\/|\/(?:about|privacy|terms)|\/r\/[A-Za-z0-9_-]{1,128})$/.test(pathname)) return {};
  const host = request.get("host");
  const scheme = request.get("x-forwarded-proto") === "https" ? "https" : "http";
  if (!host || !/^[\w.:[\]-]+$/.test(host)) return {};
  const origin = `${scheme}://${host}`;
  const ar = origin + pathname;
  const en = origin + localizedPath(pathname, "en");
  return { alternates: { canonical: (await getI18n()).locale === "en" ? en : ar, languages: { ar, en, "x-default": ar } } };
}
