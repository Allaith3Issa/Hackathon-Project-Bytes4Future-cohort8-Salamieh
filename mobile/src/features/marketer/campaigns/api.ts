import { apiRequest } from '@/core/api';
import type { PaginatedResponse } from '@/core/api';
import type {
  Campaign,
  CampaignFeedPayload,
  CampaignViewModel,
  MarketerMembership,
} from './types';

export const DEFAULT_MARKETER_CAMPAIGNS_PAGE_SIZE = 20;
const MAX_MEMBERSHIP_PAGES = 20;

export interface FetchCampaignsParams {
  page?: number;
  pageSize?: number;
  q?: string;
  signal?: AbortSignal;
}

export interface FetchCampaignFeedParams {
  page?: number;
  pageSize?: number;
  q?: string;
  signal?: AbortSignal;
  existingMembershipsByCampaignId?: Map<string, MarketerMembership>;
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
  query.set('pageSize', String(params.pageSize ?? DEFAULT_MARKETER_CAMPAIGNS_PAGE_SIZE));

  const trimmedQuery = params.q?.trim();
  if (trimmedQuery) {
    query.set('q', trimmedQuery);
  }

  return apiRequest<PaginatedResponse<Campaign>>(`/campaigns?${query.toString()}`, {
    method: 'GET',
    auth: true,
    signal: params.signal,
  });
}

/**
 * GET /api/v1/marketer/memberships
 * Fetches the marketer's memberships so campaign cards reflect joined status in O(1).
 */
export async function fetchMarketerMemberships(
  page = 1,
  pageSize = 100,
  signal?: AbortSignal,
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
      signal,
    },
  );
}

/**
 * Fetches all marketer membership pages (bounded for safety) into a single Map<campaignId, MarketerMembership>.
 */
export async function fetchAllMarketerMemberships(
  signal?: AbortSignal,
): Promise<Map<string, MarketerMembership>> {
  const membershipByCampaignId = new Map<string, MarketerMembership>();
  let page = 1;

  while (page <= MAX_MEMBERSHIP_PAGES) {
    if (signal?.aborted) {
      break;
    }

    const membershipsPage = await fetchMarketerMemberships(page, 100, signal);
    for (const membership of membershipsPage.items) {
      membershipByCampaignId.set(membership.campaign.id, membership);
    }

    if (membershipsPage.nextPage === null || membershipsPage.nextPage <= page) {
      break;
    }
    page = membershipsPage.nextPage;
  }

  return membershipByCampaignId;
}

/**
 * Fetches active campaigns (with optional ?q= and pagination) and marketer memberships,
 * merging them via Map<campaignId, MarketerMembership> in O(n + m).
 */
export async function fetchCampaignFeed(
  params: FetchCampaignFeedParams = {},
): Promise<CampaignFeedPayload> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? DEFAULT_MARKETER_CAMPAIGNS_PAGE_SIZE;
  const shouldFetchMemberships =
    page === 1 || !params.existingMembershipsByCampaignId;

  const [campaignsPage, membershipsByCampaignId] = await Promise.all([
    fetchActiveCampaigns({
      page,
      pageSize,
      q: params.q,
      signal: params.signal,
    }),
    shouldFetchMemberships
      ? fetchAllMarketerMemberships(params.signal)
      : Promise.resolve(params.existingMembershipsByCampaignId!),
  ]);

  const orderedIds: string[] = [];
  const byId = new Map<string, CampaignViewModel>();

  for (const campaign of campaignsPage.items) {
    if (!byId.has(campaign.id)) {
      orderedIds.push(campaign.id);
    }
    byId.set(campaign.id, {
      campaign,
      membership: membershipsByCampaignId.get(campaign.id) ?? null,
    });
  }

  return {
    orderedIds,
    byId,
    membershipsByCampaignId: new Map(membershipsByCampaignId),
    nextPage: campaignsPage.nextPage,
    total: campaignsPage.total,
  };
}

/**
 * Merges two CampaignFeedPayload snapshots via Map while preserving server order
 * and deduplicating campaign IDs in O(n + m).
 */
export function mergeCampaignFeedPages(
  primary: CampaignFeedPayload,
  secondary: CampaignFeedPayload,
  options: { preserveNextPage?: number | null } = {},
): CampaignFeedPayload {
  const mergedMemberships = new Map<string, MarketerMembership>(
    secondary.membershipsByCampaignId,
  );
  for (const [campaignId, membership] of primary.membershipsByCampaignId) {
    mergedMemberships.set(campaignId, membership);
  }

  const nextById = new Map<string, CampaignViewModel>();
  const nextOrderedIds: string[] = [];
  const seenIds = new Set<string>();

  for (const id of primary.orderedIds) {
    const entry = primary.byId.get(id);
    if (!entry || seenIds.has(id)) {
      continue;
    }
    seenIds.add(id);
    nextOrderedIds.push(id);
    nextById.set(id, {
      campaign: entry.campaign,
      membership:
        mergedMemberships.get(id) ?? entry.membership ?? null,
    });
  }

  for (const id of secondary.orderedIds) {
    const entry = secondary.byId.get(id);
    if (!entry || seenIds.has(id)) {
      continue;
    }
    seenIds.add(id);
    nextOrderedIds.push(id);
    nextById.set(id, {
      campaign: entry.campaign,
      membership:
        mergedMemberships.get(id) ?? entry.membership ?? null,
    });
  }

  return {
    orderedIds: nextOrderedIds,
    byId: nextById,
    membershipsByCampaignId: mergedMemberships,
    nextPage:
      options.preserveNextPage !== undefined
        ? options.preserveNextPage
        : secondary.nextPage,
    total:
      options.preserveNextPage !== undefined ? primary.total : secondary.total,
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
  const nextMemberships = new Map(feed.membershipsByCampaignId);
  nextMemberships.set(membership.campaign.id, membership);

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
    membershipsByCampaignId: nextMemberships,
    nextPage: feed.nextPage,
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
