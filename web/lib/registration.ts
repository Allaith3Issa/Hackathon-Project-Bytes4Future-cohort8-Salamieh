import type { Translate } from "./i18n";

export const DEFAULT_ROLES = ["customer", "marketer", "merchant"] as const;
export type RegistrationRole = (typeof DEFAULT_ROLES)[number];

export interface RegistrationErrors {
  roles?: string;
  name?: string;
  phone?: string;
  password?: string;
  confirmation?: string;
  shopName?: string;
  shopDetails?: string;
  error?: string;
}

function formText(data: FormData, field: string) {
  const value = data.get(field);
  return typeof value === "string" ? value : "";
}

export function validateRegistration(data: FormData, t: Translate) {
  const selected = data.getAll("roles");
  const roles = DEFAULT_ROLES.filter((role) => selected.includes(role));
  const name = formText(data, "name").trim();
  const phone = formText(data, "phone");
  const password = formText(data, "password");
  const confirmation = formText(data, "confirmation");
  const shop = roles.includes("merchant") ? {
    name: formText(data, "shopName").trim(),
    details: formText(data, "shopDetails").trim(),
  } : undefined;

  const errors: RegistrationErrors = {};
  if (!selected.length) errors.roles = t("registration.selectAtLeastOneRoleTo");
  else if (selected.length !== roles.length) errors.roles = t("registration.checkTheSelectedRoles");
  if (!name) errors.name = t("validation.enterYourFullName");
  else if (name.length > 120) errors.name = t("validation.yourFullNameMustBe120");
  if (phone.length !== 10 || !/^09[0-9]{8}$/.test(phone)) errors.phone = t("validation.syrianPhone");
  if (!password) errors.password = t("auth.passwordRequired");
  else if (new TextEncoder().encode(password).length > 72) {
    errors.password = t("validation.yourPasswordIsMoreThan72");
  }
  if (!confirmation) errors.confirmation = t("validation.reEnterYourPasswordToConfirm");
  else if (password !== confirmation) errors.confirmation = t("validation.thePasswordsDonTMatch");
  if (shop) {
    if (!shop.name) errors.shopName = t("validation.enterTheStoreName");
    else if (shop.name.length > 120) errors.shopName = t("validation.theStoreNameMustBe120");
    if (!shop.details) errors.shopDetails = t("validation.enterTheStoreDescription");
    else if (shop.details.length > 2000) errors.shopDetails = t("validation.theStoreDescriptionMustBe2");
  }

  return { errors, body: { name, phone, password, roles, ...(shop ? { shop } : {}) } };
}
