import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isLocale, localeCookie, localeHeader, localizedPath, pathnameHeader, splitLocale } from "@/lib/locale";

export function proxy(request: NextRequest) {
  const path = splitLocale(request.nextUrl.pathname);
  const saved = request.cookies.get(localeCookie)?.value;
  const locale = path.locale ?? (isLocale(saved) ? saved : defaultLocale);
  const navigation = request.method === "GET" || request.method === "HEAD";
  const url = request.nextUrl.clone();
  const headers = new Headers(request.headers);
  headers.set(localeHeader, locale);
  headers.set(pathnameHeader, path.pathname);

  let response: NextResponse;
  if (!path.locale && navigation && locale === "en") {
    url.pathname = localizedPath(path.pathname, "en");
    response = NextResponse.redirect(url);
    response.headers.set("Cache-Control", "private, no-store");
  } else if (!path.locale) {
    url.pathname = localizedPath(path.pathname, locale, true);
    response = NextResponse.rewrite(url, { request: { headers } });
  } else {
    response = NextResponse.next({ request: { headers } });
  }

  const documentNavigation = navigation && !request.headers.has("rsc");
  if (documentNavigation && path.locale && path.locale !== saved) {
    response.cookies.set(localeCookie, locale, {
      path: "/", sameSite: "lax", maxAge: 31536000, httpOnly: true, secure: request.nextUrl.protocol === "https:",
    });
  }
  return response;
}

export const config = {
  matcher: ["/((?!api/|_next/|brand/|images/|session/|.*\\.[^/]+$).*)"],
};
