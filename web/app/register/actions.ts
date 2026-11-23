"use server";

import { getI18n, redirectLocalized } from "@/lib/i18n-server";
import { apiRequest, ApiError } from "@/lib/api";
import type { AuthSession } from "@/lib/contract";
import { publicAccountDestination } from "@/lib/public-account-destination";
import { validateRegistration, type RegistrationErrors } from "@/lib/registration";
import { requireAccount, saveSession } from "@/lib/session";
import { errorMessage } from "@/lib/ui";

export async function signUp(offer: string | undefined, _state: RegistrationErrors, data: FormData): Promise<RegistrationErrors> {
  await requireAccount();
  const { t } = await getI18n();
  const { body, errors } = validateRegistration(data, t);
  if (Object.keys(errors).length) return errors;

  try {
    const session = await apiRequest<AuthSession>("/auth/register", { method: "POST", body });
    if (session.user.roles.length !== body.roles.length || !body.roles.every((role) => session.user.roles.includes(role))) {
      return { error: t("registration.weCouldnTStartASession") };
    }
    await saveSession(session);
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.code === "PHONE_ALREADY_REGISTERED") {
        return { phone: t("registration.thisPhoneNumberIsAlreadyRegistered") };
      }
      if (error.code === "VALIDATION_ERROR") {
        const fields = error.fields ?? {};
        const issues: RegistrationErrors = {};
        if (fields.name) issues.name = t("registration.checkYourFullName");
        if (fields.phone) issues.phone = t("auth.checkYourPhoneNumber");
        if (fields.password) issues.password = t("auth.checkYourPassword");
        if (fields.roles) issues.roles = t("registration.checkTheSelectedRoles");
        if (fields["shop.name"]) issues.shopName = t("registration.checkTheStoreName");
        if (fields["shop.details"]) issues.shopDetails = t("registration.checkTheStoreDescription");
        if (fields.shop && !issues.shopName && !issues.shopDetails) issues.shopName = t("registration.checkYourStoreDetails");
        return Object.keys(issues).length ? issues : { error: t("registration.checkTheDetailsYouEnteredThen") };
      }
    }
    return { error: errorMessage(error, t) };
  }

  return redirectLocalized(publicAccountDestination(body.roles, offer) ?? "/");
}
