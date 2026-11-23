import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";
import { apiRequest, ApiError } from "./api";
import type { Account, AuthSession } from "./contract";
import { redirectLocalized } from "./i18n-server";
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

export async function requireAccount() {
  return (await getAccount()) ?? redirectLocalized("/login");
}

export async function requirePageAccount() {
  const account = await getAccount();
  if (account || (await sessionTokens()).refreshToken) return account;
  return redirectLocalized("/login");
}

export async function authenticatedRequest<T>(
  path: `/${string}`,
  options: Omit<NonNullable<Parameters<typeof apiRequest>[1]>, "accessToken"> = {},
) {
  const { accessToken } = await sessionTokens();
  if (!accessToken) throw new ApiError(401, "AUTH_REQUIRED");
  return apiRequest<T>(path, { ...options, accessToken });
}
