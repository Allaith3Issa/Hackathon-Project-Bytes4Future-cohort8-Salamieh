import type { Account } from "./contract";
export type { Page } from "./contract";

export interface MerchantWallet { availableBalanceSyp: number; totalLockedReservesSyp: number; creditLimitSyp: number }
export interface MerchantDashboard {
  verificationStatus: MerchantVerificationStatus;
  wallet: MerchantWallet;
  activeCampaignsCount: number;
  topCampaign: { campaignId: string; productName: string; grossCashSalesSyp: number; salesCount: number } | null;
  stats: {
    clicks: number;
    salesCount: number;
    itemsSold: number;
    grossCashSalesSyp: number;
    commissionPaidSyp: number;
    platformFeesPaidSyp: number;
    conversionRatePercent: number;
  };
}
export interface MerchantWalletTransaction {
  id: string;
  kind: "merchant_topup" | "campaign_reserve_lock" | "campaign_reserve_unlock" | "sale_reserve_debit" | "cashback_voucher_merchant_credit";
  amountSyp: number;
  campaignId: string | null;
  campaignName: string | null;
  referenceNote: string | null;
  createdAt: string;
}
export interface MarketerWallet {
  availableBalanceSyp: number;
  pendingPayoutSyp: number;
  totalEarnedSyp: number;
  totalConfirmedPaidOutSyp: number;
}
export interface AdminRevenueSummary { netPlatformFeesSyp: number; totalMarketerCommissionSyp: number }
export interface AdminMarketerEarnings {
  id: string;
  name: string;
  phone: string;
  salesCount: number;
  totalEarnedSyp: number;
}
export interface AdminMerchant {
  id: string; name: string; phone: string; roles: Account["roles"]; createdAt: string;
  merchant: NonNullable<Account["merchant"]>; wallet: MerchantWallet;
}
export const merchantVerificationStatuses = ["pending", "verified", "rejected"] as const;
export type MerchantVerificationStatus = (typeof merchantVerificationStatuses)[number];
export type MerchantVerificationDecision = Exclude<MerchantVerificationStatus, "pending">;
export type PaymentMethod = "cash" | "sham_cash" | "syriatel_cash" | "bank_transfer";
export interface AdminTopupResult {
  topupId: string; merchantId: string; shopName: string; amountSyp: number; paymentMethod: PaymentMethod;
  referenceNote: string; merchantNewAvailableBalanceSyp: number; createdAt: string;
}
export interface CampaignPreview {
  finalPriceSyp: number | null; sampleSaleAmountSyp: number; commissionPerUnitSyp: number;
  platformTotalFeeSampleSyp: number; customerCashbackSampleSyp: number; platformNetFeeSampleSyp: number;
  merchantNetSampleSyp: number; worstCaseReserveSyp: number; isAffordableByMerchant: boolean;
  merchantAvailableBalanceSyp: number;
}
export interface MerchantCampaign {
  id: string; productName: string; shopName: string; description: string; imageUrl: string;
  originalPriceSyp: number | null; discountPercent: number; finalPriceSyp: number | null;
  commissionPerItemSyp: number | null; joinMode: "open" | "approval_required";
  status: "active" | "ended"; endsAt: string;
  usage: {
    maxItems: number | null; itemsSold: number; itemsLeft: number | null; worstCaseReserveSyp: number;
    lockedBudgetSyp: number; commissionsPaidSyp: number; platformFeesPaidSyp: number;
  };
}
export type ScannerLookup =
  | {
      kind: "offer_qr"; passId: string; campaignId: string; productName: string; customerName: string;
      discountPercent: number; finalPriceSyp: number | null; maxQuantity: number | null;
      availableQuantityOptions: { quantity: number; customerPaidCashSyp: number }[]; status: "active";
    }
  | { kind: "cashback_voucher"; voucherId: string; customerName: string; amountSyp: number; status: "active" };
export interface OfferRedeemResult {
  saleId: string; campaignId: string; productName: string; quantity: number; originalAmountSyp: number;
  customerPaidCashSyp: number; marketerCommissionSyp: number; platformTotalFeeSyp: number;
  customerCashbackSyp: number; platformNetFeeSyp: number; remainingLockedBudgetSyp: number;
  campaignStatusAfterSale: "active" | "ended"; scannedAt: string;
}

export interface VoucherRedeemResult {
  voucherId: string; amountSyp: number; billTotalSyp: number; customerPaidCashSyp: number;
  merchantNewAvailableBalanceSyp: number; redeemedAt: string;
}
