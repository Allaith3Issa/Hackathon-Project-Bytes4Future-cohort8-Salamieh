import "server-only";
import { redirectLocalized } from "./i18n-server";
import { ApiError } from "./api";
import { getAccount } from "./session";

export async function requireRole(role: "admin" | "merchant") {
  const account = await getAccount();
  if (!account || !account.roles.includes(role)) return redirectLocalized(role === "admin" ? "/admin" : "/merchant/login");
  return account;
}

export async function expiredRedirect(error: unknown, role: "admin" | "merchant") {
  if (error instanceof ApiError && error.status === 401) return redirectLocalized(role === "admin" ? "/admin" : "/merchant/login");
}
