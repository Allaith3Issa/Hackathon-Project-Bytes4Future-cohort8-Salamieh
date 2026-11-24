/**
 * Merchant wallet & ledger DTOs aligned 1:1 with API_CONTRACT.md:
 * - GET /api/v1/merchant/wallet
 * - GET /api/v1/merchant/wallet/transactions
 * Monetary fields ending in Syp are nonnegative integers in minor units (100 = 1.00 new SYP).
 */
export interface MerchantWallet {
  availableBalanceSyp: number;
  totalLockedReservesSyp: number;
  creditLimitSyp: number;
}

export type MerchantWalletTransactionKind =
  | 'merchant_topup'
  | 'campaign_reserve_lock'
  | 'campaign_reserve_unlock'
  | 'sale_reserve_debit'
  | 'cashback_voucher_merchant_credit';

export interface MerchantWalletTransaction {
  id: string;
  kind: MerchantWalletTransactionKind;
  amountSyp: number;
  campaignId: string | null;
  campaignName: string | null;
  referenceNote: string | null;
  createdAt: string;
}
