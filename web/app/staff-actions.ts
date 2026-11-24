"use server";

import { getI18n, redirectLocalized } from "@/lib/i18n-server";
import { localizedPath } from "@/lib/locale";
import { revalidatePath } from "next/cache";
import { ApiError, apiRequest } from "@/lib/api";
import type { AuthSession } from "@/lib/contract";
import { authenticatedRequest, saveSession } from "@/lib/session";
import { expiredRedirect, requireRole } from "@/lib/staff";
import type {
  VoucherRedeemResult, AdminMerchant, AdminTopupResult, CampaignPreview, MerchantCampaign, MerchantVerificationDecision,
  OfferRedeemResult, ScannerLookup,
} from "@/lib/staff-contract";
import { parseMoney, parsePercent, parsePositiveMoney, staffError } from "@/lib/staff-ui";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KEY_ERROR = "auth.weCouldnTPrepareTheRequest";
const methods = ["cash", "sham_cash", "syriatel_cash", "bank_transfer"];
const text = (d: FormData, k: string) => String(d.get(k) ?? "").trim();
const digits = (v: string) => v.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632));


export interface StaffSignInState { error?: string; phoneError?: string; passwordError?: string }

export async function staffSignIn(
  kind: "admin" | "merchant", _state: StaffSignInState, data: FormData,
): Promise<StaffSignInState> {
  const { t } = await getI18n();
  const phone = digits(text(data, "phone"));
  const password = String(data.get("password") ?? "");
  const phoneError = /^09[0-9]{8}$/.test(phone) ? undefined : t("auth.syrianPhone");
  const passwordError = password ? undefined : t("auth.passwordRequired");
  if (phoneError || passwordError) return { phoneError, passwordError };
  try {
    const session = await apiRequest<AuthSession>(kind === "admin" ? "/auth/admin/login" : "/auth/login", {
      method: "POST", body: { phone, password },
    });
    if (!session.user.roles.includes(kind)) {
      return { error: kind === "admin" ? t("auth.thisAccountDoesNotHaveThe") : t("auth.thisAccountDoesNotHaveThe2") };
    }
    await saveSession(session);
  } catch (error) {
    return { error: staffError(error, t) };
  }
  return redirectLocalized(kind === "admin" ? "/admin/revenue" : "/merchant/campaigns/new");
}


export interface TopupState {
  result?: AdminTopupResult; error?: string;
  errors?: Partial<Record<"merchantId" | "amount" | "note", string>>;
}

export interface MerchantVerificationState {
  result?: { name: string; status: MerchantVerificationDecision };
  error?: string;
}

export async function verifyMerchant(data: FormData): Promise<MerchantVerificationState> {
  await requireRole("admin");
  const { t, locale } = await getI18n();
  const merchantId = text(data, "merchantId");
  const status = text(data, "status");
  if (!uuid.test(merchantId) || (status !== "verified" && status !== "rejected")) {
    return { error: t("errors.checkTheInformationYouEnteredThen") };
  }
  const queuePath = localizedPath("/admin/merchants", locale, true);
  try {
    const account = await authenticatedRequest<AdminMerchant>(`/admin/merchants/${merchantId}/verification`, {
      method: "PATCH",
      body: { status },
    });
    revalidatePath(queuePath);
    if (status === "verified") revalidatePath(localizedPath("/admin/topups", locale, true));
    return { result: { name: account.merchant.name, status } };
  } catch (error) {
    await expiredRedirect(error, "admin");
    if (error instanceof ApiError && error.code === "INVALID_STATUS_TRANSITION") {
      revalidatePath(queuePath);
      return { error: t("verification.alreadyDecided") };
    }
    return { error: staffError(error, t) };
  }
}

export async function topUp(_state: TopupState, data: FormData): Promise<TopupState> {
  await requireRole("admin");
  const { t, locale } = await getI18n();
  const key = text(data, "key");
  const merchantId = text(data, "merchantId");
  const amount = parseMoney(text(data, "amount"));
  const method = text(data, "paymentMethod");
  const note = text(data, "note");
  if (!uuid.test(key)) return { error: t(KEY_ERROR) };
  const errors: NonNullable<TopupState["errors"]> = {};
  if (!merchantId) errors.merchantId = t("validation.selectAMerchant");
  if (!amount) errors.amount = t("validation.enterAnAmountGreaterThanZero");
  if (!note) errors.note = t("validation.enterAPaymentReference");
  if (!methods.includes(method)) return { error: t("validation.selectAPaymentMethod") };
  if (Object.keys(errors).length) return { errors };
  try {
    const result = await authenticatedRequest<AdminTopupResult>(
      `/admin/merchants/${encodeURIComponent(merchantId)}/topups`,
      { method: "POST", idempotencyKey: key, body: { amountSyp: amount, paymentMethod: method, referenceNote: note } },
    );
    revalidatePath(localizedPath("/admin/topups", locale, true));
    return { result };
  } catch (error) {
    return { error: staffError(error, t) };
  }
}


export interface CampaignState {
  preview?: { key: string; values: CampaignPreview };
  error?: string;
  errors?: Record<string, string>;
}

export async function campaignAction(state: CampaignState, data: FormData): Promise<CampaignState> {
  await requireRole("merchant");
  const { t } = await getI18n();
  const launch = text(data, "intent") === "launch";
  const key = text(data, "key");
  const preview = state.preview?.key === key ? state.preview : undefined;
  const price = parseMoney(text(data, "originalPriceSyp"));
  const commission = parseMoney(text(data, "commissionSyp"));
  const maxItems = /^[0-9]{1,10}$/.test(digits(text(data, "maxItems"))) ? Number(digits(text(data, "maxItems"))) : null;
  const discount = parsePercent(text(data, "discountPercent"));
  const errors: Record<string, string> = {};
  if (!price) errors.originalPriceSyp = t("validation.enterAPriceGreaterThanZero");
  if (discount === null) errors.discountPercent = t("validation.enterAPercentageBetween0And");
  if (commission === null) errors.commissionSyp = t("validation.enterAValidCommissionItCan");
  if (!maxItems || maxItems > 2147483647) errors.maxItems = t("validation.enterAWholeNumberOfItems");
  const productName = text(data, "productName");
  const description = text(data, "description");
  const imageUrl = text(data, "imageUrl");
  const endsRaw = text(data, "endsAt");
  const endsAt = endsRaw ? new Date(`${endsRaw}+03:00`) : null; 
  if (launch) {
    if (!productName) errors.productName = t("validation.enterTheProductName");
    if (!description) errors.description = t("validation.enterAProductDescription");
    if (!/^https?:\/\/\S+$/i.test(imageUrl)) errors.imageUrl = t("validation.enterAnImageUrlStartingWith");
    if (!endsAt || Number.isNaN(endsAt.getTime()) || endsAt.getTime() <= Date.now()) errors.endsAt = t("validation.chooseAnEndDateInThe");
  }
  if (Object.keys(errors).length) return { preview, errors };
  if (!uuid.test(key)) return { error: t(KEY_ERROR) };
  const base = {
    campaignType: "product", originalPriceSyp: price, discountPercent: discount,
    commission: { type: "fixed", amountSyp: commission }, maxItems,
  };
  try {
    if (!launch) {
      const values = await authenticatedRequest<CampaignPreview>("/merchant/campaigns/preview", { method: "POST", body: base });
      return { preview: { key, values } };
    }
    const campaign = await authenticatedRequest<MerchantCampaign>("/merchant/campaigns", {
      method: "POST", idempotencyKey: key,
      body: { ...base, productName, description, imageUrl, endsAt: endsAt!.toISOString(), joinMode: "open" },
    });
    return redirectLocalized(`/merchant/campaigns/${encodeURIComponent(campaign.id)}`);
  } catch (error) {
    if (error instanceof ApiError || (error as { digest?: string })?.digest === undefined) return { preview, error: staffError(error, t) };
    throw error;
  }
}

export interface CloseState { campaign?: MerchantCampaign; error?: string }

export async function closeCampaign(id: string, _state: CloseState): Promise<CloseState> {
  await requireRole("merchant");
  const { t, locale } = await getI18n();
  const path = `/merchant/campaigns/${encodeURIComponent(id)}` as const;
  try {
    const campaign = await authenticatedRequest<MerchantCampaign>(`${path}/close`, { method: "POST" });
    revalidatePath(localizedPath(path, locale, true));
    revalidatePath(localizedPath("/merchant", locale, true), "layout");
    return { campaign };
  } catch (error) {
    return { error: staffError(error, t) };
  }
}


export async function lookupOffer(code: string): Promise<{ lookup?: ScannerLookup; error?: string }> {
  await requireRole("merchant");
  const { t } = await getI18n();
  const value = code.trim();
  if (!value || value.length > 200) return { error: t("validation.enterTheCodeShownOnThe") };
  try {
    return { lookup: await authenticatedRequest<ScannerLookup>("/merchant/scanner/lookup", { method: "POST", body: { code: value } }) };
  } catch (error) {
    return { error: staffError(error, t) };
  }
}

const offerSettlementRejections = new Set([
  "QR_EXPIRED", "CAMPAIGN_ENDED", "CAMPAIGN_LIMIT_EXCEEDED", "INSUFFICIENT_LOCKED_BUDGET", "AMOUNT_OUT_OF_RANGE",
]);

export async function redeemOffer(merchantId: string, code: string, key: string): Promise<
  { result: OfferRedeemResult } | { error: string; outcome: "rejected" | "already_redeemed" | "uncertain" }
> {
  const account = await requireRole("merchant");
  const { t } = await getI18n();
  if (account.id !== merchantId) {
    return { error: t("errors.youDonTHavePermissionTo"), outcome: "uncertain" };
  }
  if (!uuid.test(key)) return { error: t(KEY_ERROR), outcome: "uncertain" };
  try {
    const result = await authenticatedRequest<OfferRedeemResult>("/merchant/scanner/redeem-offer", {
      method: "POST", idempotencyKey: key, body: { code: code.trim() },
    });
    if (!result || typeof result.saleId !== "string" || !uuid.test(result.saleId)) {
      return { error: t("scanner.offerResultUnconfirmed"), outcome: "uncertain" };
    }
    return { result };
  } catch (error) {
    const message = staffError(error, t);
    // Nest replays committed results before running settlement. Only its explicit
    // settlement conflicts establish a terminal outcome. Other responses can occur before replay.
    if (error instanceof ApiError && error.status === 409) {
      if (error.code === "QR_ALREADY_REDEEMED") return { error: message, outcome: "already_redeemed" };
      if (offerSettlementRejections.has(error.code)) {
        return { error: message, outcome: "rejected" };
      }
    }
    return { error: message, outcome: "uncertain" };
  }
}

export type VoucherOutcome = "uncertain" | "exceeds" | "rejected";

export async function redeemVoucher(
  code: string, billTotal: string, key: string,
): Promise<{ result?: VoucherRedeemResult; error?: string; outcome?: VoucherOutcome }> {
  await requireRole("merchant");
  const { t } = await getI18n();
  const bill = parsePositiveMoney(billTotal);
  if (!bill) return { error: t("validation.enterABillTotalGreaterThan") };
  if (!uuid.test(key)) return { error: t(KEY_ERROR), outcome: "rejected" };
  try {
    return { result: await authenticatedRequest<VoucherRedeemResult>("/merchant/scanner/redeem-voucher", { method: "POST", idempotencyKey: key, body: { code: code.trim(), billTotalSyp: bill } }) };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status >= 500 || error.code === "RATE_LIMITED") return { error: staffError(error, t), outcome: "uncertain" };
      if (error.code === "VOUCHER_EXCEEDS_BILL") return { error: staffError(error, t), outcome: "exceeds" };
    }
    return { error: staffError(error, t), outcome: "rejected" };
  }
}
