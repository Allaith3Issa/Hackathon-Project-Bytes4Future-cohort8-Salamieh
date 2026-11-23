import { errorMessage } from "./ui";
import type { MessageKey, Translate } from "./i18n";
import type { PaymentMethod } from "./staff-contract";

export const fieldClass = "min-h-12 w-full rounded-lg border border-control bg-white px-3 text-ink";
export const paymentLabels: Record<PaymentMethod, MessageKey> = {
  cash: "merchant.cash", sham_cash: "merchant.shamCash", syriatel_cash: "merchant.syriatelCash", bank_transfer: "merchant.bankTransfer",
};
export const statusLabels = { active: "merchant.active", ended: "merchant.ended" } as const;

const messages: Record<string, MessageKey> = {
  VALIDATION_ERROR: "errors.checkTheInformationYouEnteredThen",
  FORBIDDEN: "errors.youDonTHavePermissionTo",
  MERCHANT_NOT_VERIFIED: "errors.theStoreIsAwaitingVerificationCampaigns",
  NOT_FOUND: "errors.weCouldnTFindThatItem",
  INSUFFICIENT_MERCHANT_BALANCE: "errors.yourBalanceIsBelowTheRequired",
  INSUFFICIENT_LOCKED_BUDGET: "errors.theCampaignSLockedReserveIs",
  AMOUNT_OUT_OF_RANGE: "errors.theAmountIsOutsideTheSupported",
  IDEMPOTENCY_KEY_REUSED: "errors.theRequestDetailsChangedAfterSubmission",
  INVALID_STATUS_TRANSITION: "errors.thisActionIsUnavailableInThe",
  QR_ALREADY_REDEEMED: "errors.thisCodeHasAlreadyBeenUsed",
  VOUCHER_EXCEEDS_BILL: "errors.theBillTotalIsBelowThe",
  QR_EXPIRED: "errors.thisCodeExpiredWhenTheCampaign",
};

export function staffError(error: unknown, t: Translate) {
  const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
  return typeof code === "string" && Object.hasOwn(messages, code) ? t(messages[code]) : errorMessage(error, t);
}

const arabicDigits = (v: string) => v.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632));
const dotted = (v: string) => arabicDigits(v.trim()).replace(/[٫,،]/g, ".");


export function parseMoney(input: string): number | null {
  const m = /^([0-9]{1,14})(?:\.([0-9]{1,2}))?$/.exec(dotted(input));
  if (!m) return null;
  const minor = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(minor) ? minor : null;
}


export function parsePositiveMoney(input: string): number | null {
  const minor = parseMoney(input);
  return minor !== null && minor > 0 ? minor : null;
}


export function parsePercent(input: string): number | null {
  const v = dotted(input);
  if (!/^(100|[0-9]{1,2})(\.[0-9]{1,2})?$/.test(v)) return null;
  const n = Number(v);
  return n <= 100 ? n : null;
}
