import type { CampaignStatus, CampaignType, CommissionSpec, JoinMode } from '@/core/campaigns';
import type { MerchantStats } from '../dashboard';

export type {
  Campaign,
  CampaignStatus,
  CampaignType,
  CommissionSpec,
  JoinMode,
} from '@/core/campaigns';
export type { MerchantStats } from '../dashboard';

export interface CampaignUsage {
  maxItems: number | null;
  itemsSold: number;
  itemsLeft: number | null;
  maxSalesVolumeSyp: number | null;
  salesVolumeSyp: number;
  salesVolumeLeftSyp: number | null;
  worstCaseReserveSyp: number;
  lockedBudgetSyp: number;
  commissionsPaidSyp: number;
  platformFeesPaidSyp: number;
}

export interface MerchantCampaign {
  id: string;
  campaignType: CampaignType;
  shopName: string;
  productName: string;
  description: string;
  imageUrl: string;
  originalPriceSyp: number | null;
  discountPercent: number;
  finalPriceSyp: number | null;
  commission: CommissionSpec;
  commissionPerItemSyp: number | null;
  joinMode: JoinMode;
  status: CampaignStatus;
  endsAt: string;
  directReferralUrl: string | null;
  usage: CampaignUsage;
  stats: MerchantStats;
}

export type CampaignPreviewInput =
  | {
      campaignType: 'product';
      originalPriceSyp: number;
      discountPercent: number;
      commission: CommissionSpec;
      maxItems: number;
    }
  | {
      campaignType: 'store_discount';
      discountPercent: number;
      commission: { type: 'percentage'; percent: number };
      maxSalesVolumeSyp: number;
    };

export interface CampaignPreview {
  finalPriceSyp: number | null;
  sampleSaleAmountSyp: number;
  commissionPerUnitSyp: number;
  platformTotalFeeSampleSyp: number;
  customerCashbackSampleSyp: number;
  platformNetFeeSampleSyp: number;
  merchantNetSampleSyp: number;
  worstCaseReserveSyp: number;
  isAffordableByMerchant: boolean;
  merchantAvailableBalanceSyp: number;
}

export type LaunchCampaignInput = CampaignPreviewInput & {
  productName: string;
  description: string;
  imageUrl: string;
  endsAt: string;
  joinMode: JoinMode;
};

export type MerchantCampaignStatusFilter = 'all' | CampaignStatus;

export interface MerchantCampaignQuery {
  page?: number;
  pageSize?: number;
  status?: CampaignStatus;
  signal?: AbortSignal;
}
