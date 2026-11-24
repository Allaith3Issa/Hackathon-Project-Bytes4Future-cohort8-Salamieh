/**
 * Shared pure domain types for campaigns used across workspace feature slices
 * (Marketer & Merchant) without introducing cross-role feature imports.
 */
export type CampaignType = 'product' | 'store_discount';
export type JoinMode = 'open' | 'approval_required';
export type CampaignStatus = 'active' | 'ended';

export type CommissionSpec =
  | { type: 'fixed'; amountSyp: number }
  | { type: 'percentage'; percent: number };

export interface Campaign {
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
}
