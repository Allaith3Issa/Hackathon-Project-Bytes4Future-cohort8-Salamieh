export type CampaignType = 'product' | 'store_discount';
export type JoinMode = 'open' | 'approval_required';
export type CampaignStatus = 'active' | 'ended';
export type JoinStatus = 'pending' | 'approved' | 'rejected';

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

export interface MarketerStats {
  clicks: number;
  itemsSold: number;
  earnedSyp: number;
  conversionRatePercent: number;
}

export interface MarketerMembership {
  id: string;
  status: JoinStatus;
  requestedAt: string;
  campaign: Campaign;
  referralUrl: string | null;
  stats: MarketerStats;
}

/**
 * Merged campaign + marketer participation record stored in Map<campaignId, CampaignViewModel>
 * for O(1) lookup and optimistic state updates.
 */
export interface CampaignViewModel {
  campaign: Campaign;
  membership: MarketerMembership | null;
}

export interface CampaignFeedPayload {
  orderedIds: string[];
  byId: Map<string, CampaignViewModel>;
  total: number;
}
