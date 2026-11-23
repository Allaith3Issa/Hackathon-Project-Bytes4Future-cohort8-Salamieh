export type Locale = "ar" | "en";
export const defaultLocale: Locale = "ar";
export const localeCookie = "mardood_locale";
export const localeHeader = "x-mardood-locale";
export const pathnameHeader = "x-mardood-pathname";

export function isLocale(value: unknown): value is Locale {
  return value === "ar" || value === "en";
}

export function splitLocale(pathname: string) {
  const [, prefix, ...rest] = pathname.split("/");
  return isLocale(prefix)
    ? { locale: prefix, pathname: "/" + rest.join("/") }
    : { locale: undefined, pathname };
}

export function localizedPath(href: string, locale: Locale, explicit = false) {
  if (!href.startsWith("/") || href.startsWith("//") || href.includes("\\")) return href;
  const suffixAt = href.search(/[?#]/);
  const path = suffixAt < 0 ? href : href.slice(0, suffixAt);
  const suffix = suffixAt < 0 ? "" : href.slice(suffixAt);
  if (splitLocale(path).locale) return href;
  if (locale === defaultLocale && !explicit) return href;
  return `/${locale}${path === "/" ? "" : path}${suffix}`;
}
