import type { VerificationStatus } from '@/core/auth';

/**
 * Merchant wallet & dashboard DTOs aligned 1:1 with API_CONTRACT.md (GET /api/v1/merchant/dashboard).
 * Monetary fields ending in Syp are nonnegative integers in minor units (100 = 1.00 new SYP).
 */
export interface MerchantWallet {
  availableBalanceSyp: number;
  totalLockedReservesSyp: number;
  creditLimitSyp: number;
}

export interface MerchantStats {
  clicks: number;
  salesCount: number;
  itemsSold: number;
  grossCashSalesSyp: number;
  commissionPaidSyp: number;
  platformFeesPaidSyp: number;
  conversionRatePercent: number;
}

export interface TopMerchantCampaign {
  campaignId: string;
  productName: string;
  grossCashSalesSyp: number;
  salesCount: number;
}

export interface MerchantDashboard {
  verificationStatus: VerificationStatus;
  wallet: MerchantWallet;
  activeCampaignsCount: number;
  topCampaign: TopMerchantCampaign | null;
  stats: MerchantStats;
}
