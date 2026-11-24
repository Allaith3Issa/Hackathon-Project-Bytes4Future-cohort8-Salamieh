import type { MarketerStats } from '../campaigns/types';

export type { MarketerStats };

/**
 * Marketer wallet & reporting DTOs aligned 1:1 with API_CONTRACT.md:
 * - GET /api/v1/marketer/wallet
 * - GET /api/v1/marketer/wallet/by-merchant
 * - GET /api/v1/marketer/wallet/transactions
 * - GET /api/v1/marketer/stats
 * All figures ending in Syp are nonnegative SYP minor-unit integers (100 = 1.00 new SYP) computed by the backend.
 */
export interface MarketerWallet {
  availableBalanceSyp: number;
  pendingPayoutSyp: number;
  totalEarnedSyp: number;
  totalConfirmedPaidOutSyp: number;
}

export interface MarketerMerchantEarnings {
  merchantId: string;
  shopName: string;
  salesCount: number;
  itemsSold: number;
  totalEarnedSyp: number;
}

export type MarketerWalletTransactionKind =
  | 'marketer_commission_credit'
  | 'payout_hold'
  | 'payout_release_refund'
  | 'payout_completed'
  | 'payout_transfer_reversal';

export interface MarketerWalletTransaction {
  id: string;
  kind: MarketerWalletTransactionKind;
  amountSyp: number;
  campaignId: string | null;
  campaignName: string | null;
  shopName: string | null;
  createdAt: string;
}
