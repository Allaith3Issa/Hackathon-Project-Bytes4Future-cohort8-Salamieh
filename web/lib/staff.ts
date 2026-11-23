import "server-only";
import { redirectLocalized } from "./i18n-server";
import { ApiError } from "./api";
import type { Role } from "./contract";
import { loginForRole } from "./route-access";
import { getAccount, sessionTokens } from "./session";

export async function requireRole(role: Role) {
  const account = await getAccount();
  if (!account) return redirectLocalized(loginForRole(role));
  if (!account.roles.includes(role)) return redirectLocalized("/");
  return account;
}

export async function requirePageRole(role: Role) {
  const account = await getAccount();
  if (account) return account.roles.includes(role) ? account : redirectLocalized("/");
  if ((await sessionTokens()).refreshToken) return null;
  return redirectLocalized(loginForRole(role));
}

export async function expiredRedirect(error: unknown, role: Role) {
  if (error instanceof ApiError && error.status === 401) return redirectLocalized(loginForRole(role));
}
