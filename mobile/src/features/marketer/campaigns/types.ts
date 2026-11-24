import type {
  Campaign,
  CampaignStatus,
  CampaignType,
  CommissionSpec,
  JoinMode,
} from '@/core/campaigns';

export type {
  Campaign,
  CampaignStatus,
  CampaignType,
  CommissionSpec,
  JoinMode,
} from '@/core/campaigns';

export type JoinStatus = 'pending' | 'approved' | 'rejected';

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
  membershipsByCampaignId: Map<string, MarketerMembership>;
  nextPage: number | null;
  total: number;
}
