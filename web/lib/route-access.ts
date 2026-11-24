import type { Role } from "./contract";

export function protectedRole(pathname: string): Role | undefined {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  if (normalized === "/admin" || normalized === "/merchant/login") return undefined;

  switch (normalized.split("/")[1]) {
    case "admin": return "admin";
    case "merchant": return "merchant";
    case "customer": return "customer";
    case "marketer": return "marketer";
    default: return undefined;
  }
}

export function loginForRole(role: Role) {
  if (role === "admin") return "/admin";
  if (role === "merchant") return "/merchant/login";
  return "/login";
}
