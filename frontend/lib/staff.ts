import "server-only";
import { redirect } from "next/navigation";
import { ApiError } from "./api";
import { getAccount } from "./session";

export async function requireRole(role: "admin" | "merchant") {
  const account = await getAccount();
  if (!account || !account.roles.includes(role)) redirect(role === "admin" ? "/admin" : "/merchant/login");
  return account;
}

export function expiredRedirect(error: unknown, role: "admin" | "merchant") {
  if (error instanceof ApiError && error.status === 401) redirect(role === "admin" ? "/admin" : "/merchant/login");
}
