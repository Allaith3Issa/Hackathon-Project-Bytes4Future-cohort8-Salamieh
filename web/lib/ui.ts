const number = new Intl.NumberFormat("ar-SY");
const date = new Intl.DateTimeFormat("ar-SY", {
  dateStyle: "medium",
  timeZone: "Asia/Damascus",
});

export function formatNumber(value: number) {
  return number.format(value);
}

export function formatSyp(value: number) {
  return `${number.format(value)} ل.س.`;
}

export function formatDate(value: string) {
  return date.format(new Date(value));
}

export function validReferral(code: string) {
  return /^[A-Za-z0-9_-]{1,128}$/.test(code);
}

const messages: Record<string, string> = {
  API_UNAVAILABLE: "تعذّر الاتصال بالخدمة. حاول مرة أخرى.",
  AUTH_REQUIRED: "سجّل الدخول للمتابعة.",
  SESSION_EXPIRED: "انتهت جلستك. سجّل الدخول مرة أخرى.",
  INVALID_CREDENTIALS: "تعذّر تسجيل الدخول. تحقّق من رقم الهاتف وكلمة المرور.",
  CAMPAIGN_ENDED: "انتهى هذا العرض.",
  CAMPAIGN_LIMIT_EXCEEDED: "وصل العرض إلى الحد المسموح.",
  QR_ALREADY_REDEEMED: "تم استخدام هذا الرمز من قبل.",
  QR_EXPIRED: "انتهت صلاحية هذا الرمز.",
  RATE_LIMITED: "محاولات كثيرة. انتظر قليلاً ثم حاول مرة أخرى.",
};

export function errorMessage(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
  return typeof code === "string" && Object.hasOwn(messages, code)
    ? messages[code]
    : "تعذّر إتمام الطلب. حاول مرة أخرى.";
}
