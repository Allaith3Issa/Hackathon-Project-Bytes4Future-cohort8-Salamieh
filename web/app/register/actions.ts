"use server";

import { redirect } from "next/navigation";
import { apiRequest, ApiError } from "@/lib/api";
import type { AuthSession } from "@/lib/contract";
import { publicAccountDestination } from "@/lib/public-account-destination";
import { validateRegistration, type RegistrationErrors } from "@/lib/registration";
import { saveSession } from "@/lib/session";
import { errorMessage } from "@/lib/ui";

export async function signUp(offer: string | undefined, _state: RegistrationErrors, data: FormData): Promise<RegistrationErrors> {
  const { body, errors } = validateRegistration(data);
  if (Object.keys(errors).length) return errors;

  try {
    const session = await apiRequest<AuthSession>("/auth/register", { method: "POST", body });
    if (session.user.roles.length !== body.roles.length || !body.roles.every((role) => session.user.roles.includes(role))) {
      return { error: "تعذّر بدء الجلسة بالأدوار المختارة. حاول تسجيل الدخول." };
    }
    await saveSession(session);
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.code === "PHONE_ALREADY_REGISTERED") {
        return { phone: "رقم الجوال مسجّل مسبقاً. سجّل الدخول أو استخدم رقماً آخر." };
      }
      if (error.code === "VALIDATION_ERROR") {
        const fields = error.fields ?? {};
        const issues: RegistrationErrors = {};
        if (fields.name) issues.name = "تحقّق من الاسم الكامل.";
        if (fields.phone) issues.phone = "تحقّق من رقم الجوال.";
        if (fields.password) issues.password = "تحقّق من كلمة المرور.";
        if (fields.roles) issues.roles = "تحقّق من الأدوار المختارة.";
        if (fields["shop.name"]) issues.shopName = "تحقّق من اسم المتجر.";
        if (fields["shop.details"]) issues.shopDetails = "تحقّق من وصف المتجر.";
        if (fields.shop && !issues.shopName && !issues.shopDetails) issues.shopName = "تحقّق من بيانات المتجر.";
        return Object.keys(issues).length ? issues : { error: "تحقّق من البيانات المدخلة ثم حاول مرة أخرى." };
      }
    }
    return { error: errorMessage(error) };
  }

  redirect(publicAccountDestination(body.roles, offer) ?? "/");
}
