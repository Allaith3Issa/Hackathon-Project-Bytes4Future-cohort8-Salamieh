import { apiRequest } from '@/core/api';
import type { PaginatedResponse } from '@/core/api';
import type {
  Campaign,
  CampaignFeedPayload,
  CampaignViewModel,
  MarketerMembership,
} from './types';

export interface FetchCampaignsParams {
  page?: number;
  pageSize?: number;
  q?: string;
}

/**
 * GET /api/v1/campaigns
 * Fetches active campaigns for authenticated marketers.
 */
export async function fetchActiveCampaigns(
  params: FetchCampaignsParams = {},
): Promise<PaginatedResponse<Campaign>> {
  const query = new URLSearchParams();
  query.set('page', String(params.page ?? 1));
  query.set('pageSize', String(params.pageSize ?? 50));

  const trimmedQuery = params.q?.trim();
  if (trimmedQuery) {
    query.set('q', trimmedQuery);
  }

  return apiRequest<PaginatedResponse<Campaign>>(`/campaigns?${query.toString()}`, {
    method: 'GET',
    auth: true,
  });
}

/**
 * GET /api/v1/marketer/memberships
 * Fetches the marketer's memberships so campaign cards reflect joined status in O(1).
 */
export async function fetchMarketerMemberships(
  page = 1,
  pageSize = 100,
): Promise<PaginatedResponse<MarketerMembership>> {
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  return apiRequest<PaginatedResponse<MarketerMembership>>(
    `/marketer/memberships?${query.toString()}`,
    {
      method: 'GET',
      auth: true,
    },
  );
}

/**
 * Fetches active campaigns and marketer memberships in parallel, then merges them
 * via Map<campaignId, MarketerMembership> in O(n + m) without nested array scans.
 */
export async function fetchCampaignFeed(): Promise<CampaignFeedPayload> {
  const [campaignsPage, membershipsPage] = await Promise.all([
    fetchActiveCampaigns({ page: 1, pageSize: 50 }),
    fetchMarketerMemberships(1, 100),
  ]);

  const membershipByCampaignId = new Map<string, MarketerMembership>();
  for (const membership of membershipsPage.items) {
    membershipByCampaignId.set(membership.campaign.id, membership);
  }

  const orderedIds: string[] = [];
  const byId = new Map<string, CampaignViewModel>();

  for (const campaign of campaignsPage.items) {
    orderedIds.push(campaign.id);
    byId.set(campaign.id, {
      campaign,
      membership: membershipByCampaignId.get(campaign.id) ?? null,
    });
  }

  return {
    orderedIds,
    byId,
    total: campaignsPage.total,
  };
}

/**
 * Returns a shallow-cloned CampaignFeedPayload with an updated membership in O(1).
 */
export function upsertMembershipInFeed(
  feed: CampaignFeedPayload,
  membership: MarketerMembership,
): CampaignFeedPayload {
  const nextById = new Map(feed.byId);
  const existing = nextById.get(membership.campaign.id);
  const nextOrderedIds = existing
    ? feed.orderedIds
    : [membership.campaign.id, ...feed.orderedIds];

  nextById.set(membership.campaign.id, {
    campaign: existing?.campaign ?? membership.campaign,
    membership,
  });

  return {
    orderedIds: nextOrderedIds,
    byId: nextById,
    total: existing ? feed.total : feed.total + 1,
  };
}

/**
 * GET /api/v1/campaigns/{campaignId}
 * Fetches single campaign details cleanly.
 */
export async function fetchCampaignById(campaignId: string): Promise<Campaign> {
  return apiRequest<Campaign>(`/campaigns/${encodeURIComponent(campaignId)}`, {
    method: 'GET',
    auth: true,
  });
}

/**
 * GET /api/v1/marketer/campaigns/{campaignId}/membership
 * Fetches the marketer's membership record (including referralUrl if joined).
 */
export async function fetchCampaignMembership(
  campaignId: string,
): Promise<MarketerMembership | null> {
  const response = await apiRequest<{ membership: MarketerMembership | null }>(
    `/marketer/campaigns/${encodeURIComponent(campaignId)}/membership`,
    {
      method: 'GET',
      auth: true,
    },
  );
  return response.membership ?? null;
}

/**
 * Fetches campaign details and marketer membership in parallel.
 */
export async function fetchCampaignDetails(
  campaignId: string,
): Promise<CampaignViewModel> {
  const [campaign, membership] = await Promise.all([
    fetchCampaignById(campaignId),
    fetchCampaignMembership(campaignId),
  ]);

  return {
    campaign,
    membership,
  };
}

/**
 * POST /api/v1/marketer/campaigns/{campaignId}/join
 * Joins an active open campaign and returns the authoritative MarketerMembership with referralUrl.
 */
export async function joinCampaignById(
  campaignId: string,
): Promise<MarketerMembership> {
  return apiRequest<MarketerMembership>(
    `/marketer/campaigns/${encodeURIComponent(campaignId)}/join`,
    {
      method: 'POST',
      auth: true,
    },
  );
}
