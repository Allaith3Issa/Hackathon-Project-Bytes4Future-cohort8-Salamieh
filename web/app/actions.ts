"use server";

import { getI18n, redirectLocalized } from "@/lib/i18n-server";
import QRCode from "qrcode";
import { apiRequest, ApiError } from "@/lib/api";
import type { AuthSession, OfferQrPass } from "@/lib/contract";
import { publicAccountDestination } from "@/lib/public-account-destination";
import { authenticatedRequest, saveSession } from "@/lib/session";
import { endWebSession, type logoutScope } from "@/lib/session-logout";
import { requireRole } from "@/lib/staff";
import { errorMessage, validReferral } from "@/lib/ui";

export interface SignInState {
  error?: string;
  phoneError?: string;
  passwordError?: string;
}

export async function signIn(
  { offer, customerOnly }: { offer?: string; customerOnly?: boolean },
  _state: SignInState,
  data: FormData,
): Promise<SignInState> {
  const { t } = await getI18n();
  const phone = String(data.get("phone") ?? "").trim();
  const password = String(data.get("password") ?? "");
  const phoneError = /^09[0-9]{8}$/.test(phone) ? undefined : t("auth.syrianPhone");
  const passwordError = password ? undefined : t("auth.passwordRequired");
  if (phoneError || passwordError) return { phoneError, passwordError };
  let destination: string;
  try {
    const session = await apiRequest<AuthSession>("/auth/login", {
      method: "POST",
      body: { phone, password },
    });
    if (customerOnly && !session.user.roles.includes("customer")) {
      return { error: t("auth.signInWithACustomerAccount") };
    }
    const target = publicAccountDestination(session.user.roles, offer);
    if (!target) return { error: t("auth.thisAccountDoesNotHaveA") };
    destination = target;
    await saveSession(session);
  } catch (error) {
    if (error instanceof ApiError && error.code === "VALIDATION_ERROR") {
      const fields = error.fields;
      if (fields?.phone || fields?.password) {
        return {
          phoneError: fields.phone ? t("auth.checkYourPhoneNumber") : undefined,
          passwordError: fields.password ? t("auth.checkYourPassword") : undefined,
        };
      }
    }
    return { error: errorMessage(error, t) };
  }
  return redirectLocalized(destination);
}

export async function signOut(expected: ReturnType<typeof logoutScope>) {
  const result = await endWebSession(expected);
  if (result === "session-changed") return redirectLocalized("/");
  return redirectLocalized(result === "unconfirmed" ? "/login?logout=unconfirmed" : "/login");
}

export async function recordReferralClick(code: string) {
  if (!validReferral(code)) return;
  await apiRequest<void>(`/public/referrals/${code}/clicks`, { method: "POST" });
}

export interface PassState {
  pass?: { code: string; image: string | null };
  error?: string;
}

export async function issueOfferPass(code: string, _state: PassState): Promise<PassState> {
  await requireRole("customer");
  const { t } = await getI18n();
  if (!validReferral(code)) return { error: t("auth.weCouldnTFindTheReferral") };
  try {
    const pass = await authenticatedRequest<OfferQrPass>(`/customer/referrals/${code}/offer-qr`, {
      method: "POST",
    });
    const image = await QRCode.toDataURL(pass.qrToken, { width: 256, margin: 4 })
      .catch(() => null);
    return { pass: { code: pass.passCode, image } };
  } catch (error) {
    return { error: errorMessage(error, t) };
  }
}
