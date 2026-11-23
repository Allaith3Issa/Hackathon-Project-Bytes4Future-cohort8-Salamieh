import { errorMessage } from "./ui";
import type { PaymentMethod } from "./staff-contract";

export const fieldClass = "min-h-12 w-full rounded-lg border border-control bg-white px-3 text-ink";
export const paymentLabels: Record<PaymentMethod, string> = {
  cash: "نقداً", sham_cash: "شام كاش", syriatel_cash: "سيريتل كاش", bank_transfer: "حوالة بنكية",
};
export const statusLabels = { active: "فعّالة", ended: "منتهية" } as const;

const messages: Record<string, string> = {
  VALIDATION_ERROR: "تحقّق من القيم المدخلة ثم أعد المحاولة.",
  FORBIDDEN: "ليست لديك صلاحية لهذا الإجراء.",
  MERCHANT_NOT_VERIFIED: "حساب المتجر لم يُوثَّق بعد، لذلك لا يمكن إطلاق حملة أو تأكيد بيع.",
  NOT_FOUND: "لم نجد ما تبحث عنه. تحقّق من الرمز ومن أن الحملة تخص متجرك.",
  INSUFFICIENT_MERCHANT_BALANCE: "رصيدك المتاح أقل من الاحتياطي المطلوب. اطلب شحن الرصيد من الإدارة ثم أعد المحاولة.",
  INSUFFICIENT_LOCKED_BUDGET: "الميزانية المحجوزة للحملة لا تكفي لهذه العملية.",
  AMOUNT_OUT_OF_RANGE: "المبلغ الناتج خارج النطاق المسموح. خفّض السعر أو العدد.",
  IDEMPOTENCY_KEY_REUSED: "تغيّرت بيانات الطلب بعد إرساله. ابدأ محاولة جديدة بعد تحديث الصفحة.",
  INVALID_STATUS_TRANSITION: "لا يمكن تنفيذ هذا الإجراء في الحالة الحالية.",
  QR_ALREADY_REDEEMED: "تم استخدام هذا الرمز من قبل، ولن يُسجَّل البيع مرة ثانية. اطلب من الزبون إصدار بطاقة جديدة.",
  QR_EXPIRED: "انتهت صلاحية هذا الرمز لأن الحملة انتهت. اطلب بطاقة جديدة إن كان العرض ما زال فعّالاً.",
};

export function staffError(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
  return typeof code === "string" && Object.hasOwn(messages, code) ? messages[code] : errorMessage(error);
}
