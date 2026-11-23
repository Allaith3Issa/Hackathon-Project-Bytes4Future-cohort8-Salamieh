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

export function validateRegistration(data: FormData) {
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
  if (!selected.length) errors.roles = "اختر دوراً واحداً على الأقل للمتابعة.";
  else if (selected.length !== roles.length) errors.roles = "تحقّق من الأدوار المختارة.";
  if (!name) errors.name = "أدخل اسمك الكامل.";
  else if (name.length > 120) errors.name = "الاسم الكامل يجب ألّا يتجاوز ١٢٠ حرفاً.";
  if (phone.length !== 10 || !/^09[0-9]{8}$/.test(phone)) errors.phone = "أدخل رقم جوال سورياً من ١٠ أرقام يبدأ بـ 09.";
  if (!password) errors.password = "أدخل كلمة المرور.";
  else if (new TextEncoder().encode(password).length > 72) {
    errors.password = "كلمة المرور تتجاوز حدّ ٧٢ بايت. اختصرها، فبعض الأحرف تُحسب بأكثر من بايت.";
  }
  if (!confirmation) errors.confirmation = "أعد إدخال كلمة المرور للتأكيد.";
  else if (password !== confirmation) errors.confirmation = "كلمتا المرور غير متطابقتين.";
  if (shop) {
    if (!shop.name) errors.shopName = "أدخل اسم المتجر.";
    else if (shop.name.length > 120) errors.shopName = "اسم المتجر يجب ألّا يتجاوز ١٢٠ حرفاً.";
    if (!shop.details) errors.shopDetails = "أدخل وصف المتجر.";
    else if (shop.details.length > 2000) errors.shopDetails = "وصف المتجر يجب ألّا يتجاوز ٢٠٠٠ حرف.";
  }

  return { errors, body: { name, phone, password, roles, ...(shop ? { shop } : {}) } };
}
