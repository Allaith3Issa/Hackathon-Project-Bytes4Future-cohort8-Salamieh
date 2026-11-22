"use server";

import QRCode from "qrcode";
import { redirect } from "next/navigation";
import { apiRequest, ApiError } from "@/lib/api";
import type { AuthSession, OfferQrPass } from "@/lib/contract";
import { authenticatedRequest, clearSession, saveSession, sessionTokens } from "@/lib/session";
import { errorMessage, validReferral } from "@/lib/ui";

export interface SignInState {
  error?: string;
  phoneError?: string;
  passwordError?: string;
}

export async function signIn(
  returnTo: string,
  _state: SignInState,
  data: FormData,
): Promise<SignInState> {
  const phone = String(data.get("phone") ?? "").trim();
  const password = String(data.get("password") ?? "");
  const phoneError = /^09[0-9]{8}$/.test(phone) ? undefined : "أدخل رقم جوال سورياً من ١٠ أرقام يبدأ بـ 09.";
  const passwordError = password ? undefined : "أدخل كلمة المرور.";
  if (phoneError || passwordError) return { phoneError, passwordError };
  try {
    const session = await apiRequest<AuthSession>("/auth/login", {
      method: "POST",
      body: { phone, password },
    });
    if (!session.user.roles.includes("customer")) {
      return { error: "سجّل الدخول باستخدام حساب عميل للوصول إلى عروضك." };
    }
    await saveSession(session);
  } catch (error) {
    if (error instanceof ApiError && error.code === "VALIDATION_ERROR") {
      const fields = error.fields;
      if (fields?.phone || fields?.password) {
        return {
          phoneError: fields.phone ? "تحقّق من رقم الجوال." : undefined,
          passwordError: fields.password ? "تحقّق من كلمة المرور." : undefined,
        };
      }
    }
    return { error: errorMessage(error) };
  }
  redirect(returnTo.startsWith("/r/") && validReferral(returnTo.slice(3)) ? returnTo : "/customer");
}

export async function signOut() {
  const { accessToken, refreshToken } = await sessionTokens();
  try {
    if (accessToken) {
      await apiRequest<void>("/auth/logout", {
        method: "POST",
        accessToken,
        body: refreshToken ? { refreshToken } : {},
      });
    }
  } catch {
    // Clear browser credentials even when the API session is already gone.
  } finally {
    await clearSession();
  }
  redirect("/login");
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
  if (!validReferral(code)) return { error: "لم نعثر على رابط الإحالة." };
  try {
    const pass = await authenticatedRequest<OfferQrPass>(`/customer/referrals/${code}/offer-qr`, {
      method: "POST",
    });
    const image = await QRCode.toDataURL(pass.qrToken, { width: 256, margin: 4 })
      .catch(() => null);
    return { pass: { code: pass.passCode, image } };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}
