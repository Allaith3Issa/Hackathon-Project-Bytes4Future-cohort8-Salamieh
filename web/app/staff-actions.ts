"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApiError, apiRequest } from "@/lib/api";
import type { AuthSession } from "@/lib/contract";
import { authenticatedRequest, saveSession } from "@/lib/session";
import type {
  VoucherRedeemResult, AdminTopupResult, CampaignPreview, MerchantCampaign, OfferRedeemResult, ScannerLookup,
} from "@/lib/staff-contract";
import { parseMoney, parsePercent, parsePositiveMoney, staffError } from "@/lib/staff-ui";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KEY_ERROR = "تعذّر تجهيز الطلب. حدّث الصفحة وحاول مرة أخرى.";
const methods = ["cash", "sham_cash", "syriatel_cash", "bank_transfer"];
const text = (d: FormData, k: string) => String(d.get(k) ?? "").trim();
const digits = (v: string) => v.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632));


export interface StaffSignInState { error?: string; phoneError?: string; passwordError?: string }

export async function staffSignIn(
  kind: "admin" | "merchant", _state: StaffSignInState, data: FormData,
): Promise<StaffSignInState> {
  const phone = digits(text(data, "phone"));
  const password = String(data.get("password") ?? "");
  const phoneError = /^09[0-9]{8}$/.test(phone) ? undefined : "أدخل رقم جوال سورياً من 10 أرقام يبدأ بـ 09.";
  const passwordError = password ? undefined : "أدخل كلمة المرور.";
  if (phoneError || passwordError) return { phoneError, passwordError };
  try {
    const session = await apiRequest<AuthSession>(kind === "admin" ? "/auth/admin/login" : "/auth/login", {
      method: "POST", body: { phone, password },
    });
    if (!session.user.roles.includes(kind)) {
      return { error: kind === "admin" ? "هذا الحساب ليس حساب إدارة." : "هذا الحساب ليس حساب تاجر." };
    }
    await saveSession(session);
  } catch (error) {
    return { error: staffError(error) };
  }
  redirect(kind === "admin" ? "/admin/topups" : "/merchant/campaigns/new");
}


export interface TopupState {
  result?: AdminTopupResult; error?: string;
  errors?: Partial<Record<"merchantId" | "amount" | "note", string>>;
}

export async function topUp(_state: TopupState, data: FormData): Promise<TopupState> {
  const key = text(data, "key");
  const merchantId = text(data, "merchantId");
  const amount = parseMoney(text(data, "amount"));
  const method = text(data, "paymentMethod");
  const note = text(data, "note");
  if (!uuid.test(key)) return { error: KEY_ERROR };
  const errors: NonNullable<TopupState["errors"]> = {};
  if (!merchantId) errors.merchantId = "اختر التاجر.";
  if (!amount) errors.amount = "أدخل مبلغاً صحيحاً أكبر من صفر.";
  if (!note) errors.note = "أدخل مرجع الدفع.";
  if (!methods.includes(method)) return { error: "اختر طريقة الدفع." };
  if (Object.keys(errors).length) return { errors };
  try {
    const result = await authenticatedRequest<AdminTopupResult>(
      `/admin/merchants/${encodeURIComponent(merchantId)}/topups`,
      { method: "POST", idempotencyKey: key, body: { amountSyp: amount, paymentMethod: method, referenceNote: note } },
    );
    revalidatePath("/admin/topups");
    return { result };
  } catch (error) {
    return { error: staffError(error) };
  }
}


export interface CampaignState {
  preview?: { key: string; values: CampaignPreview };
  error?: string;
  errors?: Record<string, string>;
}

export async function campaignAction(state: CampaignState, data: FormData): Promise<CampaignState> {
  const launch = text(data, "intent") === "launch";
  const key = text(data, "key");
  const preview = state.preview?.key === key ? state.preview : undefined;
  const price = parseMoney(text(data, "originalPriceSyp"));
  const commission = parseMoney(text(data, "commissionSyp"));
  const maxItems = /^[0-9]{1,10}$/.test(digits(text(data, "maxItems"))) ? Number(digits(text(data, "maxItems"))) : null;
  const discount = parsePercent(text(data, "discountPercent"));
  const errors: Record<string, string> = {};
  if (!price) errors.originalPriceSyp = "أدخل سعراً صحيحاً أكبر من صفر.";
  if (discount === null) errors.discountPercent = "أدخل نسبة من 0 إلى 100.";
  if (commission === null) errors.commissionSyp = "أدخل عمولة صحيحة (يمكن أن تكون صفراً).";
  if (!maxItems || maxItems > 2147483647) errors.maxItems = "أدخل عدد قطع صحيحاً أكبر من صفر.";
  const productName = text(data, "productName");
  const description = text(data, "description");
  const imageUrl = text(data, "imageUrl");
  const endsRaw = text(data, "endsAt");
  const endsAt = endsRaw ? new Date(`${endsRaw}+03:00`) : null; 
  if (launch) {
    if (!productName) errors.productName = "أدخل اسم المنتج.";
    if (!description) errors.description = "أدخل وصفاً للمنتج.";
    if (!/^https?:\/\/\S+$/i.test(imageUrl)) errors.imageUrl = "أدخل رابط صورة يبدأ بـ http أو https.";
    if (!endsAt || Number.isNaN(endsAt.getTime()) || endsAt.getTime() <= Date.now()) errors.endsAt = "اختر موعد انتهاء في المستقبل.";
  }
  if (Object.keys(errors).length) return { preview, errors };
  if (!uuid.test(key)) return { error: KEY_ERROR };
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
    redirect(`/merchant/campaigns/${encodeURIComponent(campaign.id)}`);
  } catch (error) {
    if (error instanceof ApiError || (error as { digest?: string })?.digest === undefined) return { preview, error: staffError(error) };
    throw error;
  }
}

export interface CloseState { campaign?: MerchantCampaign; error?: string }

export async function closeCampaign(id: string, _state: CloseState): Promise<CloseState> {
  const path = `/merchant/campaigns/${encodeURIComponent(id)}` as const;
  try {
    const campaign = await authenticatedRequest<MerchantCampaign>(`${path}/close`, { method: "POST" });
    revalidatePath(path);
    return { campaign };
  } catch (error) {
    return { error: staffError(error) };
  }
}


export async function lookupOffer(code: string): Promise<{ lookup?: ScannerLookup; error?: string }> {
  const value = code.trim();
  if (!value || value.length > 200) return { error: "أدخل الرمز الظاهر على بطاقة الزبون." };
  try {
    return { lookup: await authenticatedRequest<ScannerLookup>("/merchant/scanner/lookup", { method: "POST", body: { code: value } }) };
  } catch (error) {
    return { error: staffError(error) };
  }
}

export async function redeemOffer(code: string, key: string): Promise<{ result?: OfferRedeemResult; error?: string; terminal?: boolean }> {
  if (!uuid.test(key)) return { error: KEY_ERROR, terminal: true };
  try {
    return { result: await authenticatedRequest<OfferRedeemResult>("/merchant/scanner/redeem-offer", { method: "POST", idempotencyKey: key, body: { code: code.trim() } }) };
  } catch (error) {
    const uncertain = error instanceof ApiError && (error.status >= 500 || error.code === "RATE_LIMITED");
    return { error: staffError(error), terminal: !uncertain };
  }
}

export type VoucherOutcome = "uncertain" | "exceeds" | "rejected";

export async function redeemVoucher(
  code: string, billTotal: string, key: string,
): Promise<{ result?: VoucherRedeemResult; error?: string; outcome?: VoucherOutcome }> {
  const bill = parsePositiveMoney(billTotal);
  if (!bill) return { error: "أدخل إجمالي فاتورة أكبر من صفر، حتى منزلتين عشريتين." };
  if (!uuid.test(key)) return { error: KEY_ERROR, outcome: "rejected" };
  try {
    return { result: await authenticatedRequest<VoucherRedeemResult>("/merchant/scanner/redeem-voucher", { method: "POST", idempotencyKey: key, body: { code: code.trim(), billTotalSyp: bill } }) };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status >= 500 || error.code === "RATE_LIMITED") return { error: staffError(error), outcome: "uncertain" };
      if (error.code === "VOUCHER_EXCEEDS_BILL") return { error: staffError(error), outcome: "exceeds" };
    }
    return { error: staffError(error), outcome: "rejected" };
  }
}
