import "server-only";
import { redirectLocalized } from "./i18n-server";
import { ApiError } from "./api";
import type { Role } from "./contract";
import { requireAccount, requirePageAccount } from "./session";

export async function requireRole(role: Role) {
  const account = await requireAccount();
  if (!account.roles.includes(role)) return redirectLocalized("/");
  return account;
}

export async function requirePageRole(role: Role) {
  const account = await requirePageAccount();
  if (account && !account.roles.includes(role)) return redirectLocalized("/");
  return account;
}

export async function expiredRedirect(error: unknown) {
  if (error instanceof ApiError && error.status === 401) return redirectLocalized("/login");
}
