import type { Account } from "./contract";
export type { Page } from "./contract";

export interface MerchantWallet { availableBalanceSyp: number; totalLockedReservesSyp: number; creditLimitSyp: number }
export interface AdminMerchant {
  id: string; name: string; phone: string; roles: Account["roles"]; createdAt: string;
  merchant: NonNullable<Account["merchant"]>; wallet: MerchantWallet;
}
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
