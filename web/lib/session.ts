import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { apiRequest, ApiError } from "./api";
import type { Account, AuthSession } from "./contract";
import { getI18n } from "./i18n-server";
import { localizedPath } from "./locale";
import { accessCookie, refreshCookie } from "./session-cookies";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export async function sessionTokens() {
  const jar = await cookies();
  return {
    accessToken: jar.get(accessCookie)?.value,
    refreshToken: jar.get(refreshCookie)?.value,
  };
}

export async function saveSession(session: AuthSession) {
  const jar = await cookies();
  jar.set(accessCookie, session.accessToken, { ...cookieOptions, maxAge: session.expiresInSeconds });
  jar.set(refreshCookie, session.refreshToken, { ...cookieOptions, maxAge: 2592000 });
}

export async function clearSession() {
  const jar = await cookies();
  jar.set(accessCookie, "", { ...cookieOptions, maxAge: 0 });
  jar.set(refreshCookie, "", { ...cookieOptions, maxAge: 0 });
}

export const getAccount = cache(async () => {
  const { accessToken } = await sessionTokens();
  if (!accessToken) return null;
  try {
    return await apiRequest<Account>("/auth/me", { accessToken });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
});

export async function canShowGuestAuthForm() {
  if (await getAccount()) {
    const { locale } = await getI18n();
    redirect(localizedPath("/", locale, true));
  }

  // A refresh cookie only permits recovery. The account must still be verified.
  return !(await sessionTokens()).refreshToken;
}

export async function authenticatedRequest<T>(
  path: `/${string}`,
  options: Omit<NonNullable<Parameters<typeof apiRequest>[1]>, "accessToken"> = {},
) {
  const { accessToken } = await sessionTokens();
  if (!accessToken) throw new ApiError(401, "AUTH_REQUIRED");
  return apiRequest<T>(path, { ...options, accessToken });
}
