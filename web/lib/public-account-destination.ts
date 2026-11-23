import type { Role } from "./contract";
import { validReferral } from "./ui";

export function publicAccountDestination(roles: readonly Role[], offer?: string) {
  if (roles.includes("customer")) {
    return typeof offer === "string" && validReferral(offer) ? `/r/${offer}` : "/customer";
  }
  if (roles.includes("merchant")) return "/merchant/campaigns";
  if (roles.includes("marketer")) return "/marketer/earnings";
  return null;
}
