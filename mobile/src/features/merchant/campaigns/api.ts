import { apiRequest } from '@/core/api';
import type { PaginatedResponse } from '@/core/api';
import type {
  CampaignPreview,
  CampaignPreviewInput,
  LaunchCampaignInput,
  MerchantCampaign,
  MerchantCampaignQuery,
} from './types';

export const DEFAULT_MERCHANT_CAMPAIGNS_PAGE_SIZE = 20;

/**
 * POST /api/v1/merchant/campaigns/preview
 * Authoritative read-only server calculation of final price, per-sale split,
 * worstCaseReserveSyp, and merchant affordability.
 */
export async function previewMerchantCampaign(
  input: CampaignPreviewInput,
  signal?: AbortSignal,
): Promise<CampaignPreview> {
  return apiRequest<CampaignPreview>('/merchant/campaigns/preview', {
    method: 'POST',
    auth: true,
    body: input,
    signal,
  });
}

/**
 * POST /api/v1/merchant/campaigns
 * Atomically launches campaign and locks worstCaseReserveSyp with mandatory UUID Idempotency-Key.
 */
export async function launchMerchantCampaign(
  input: LaunchCampaignInput,
  idempotencyKey: string,
): Promise<MerchantCampaign> {
  return apiRequest<MerchantCampaign>('/merchant/campaigns', {
    method: 'POST',
    auth: true,
    idempotencyKey,
    body: input,
  });
}

/**
 * GET /api/v1/merchant/campaigns
 * Lists campaigns owned by the authenticated merchant with optional status filter & pagination.
 */
export async function fetchMerchantCampaigns(
  query: MerchantCampaignQuery = {},
): Promise<PaginatedResponse<MerchantCampaign>> {
  const safePage = Math.max(1, Math.trunc(query.page ?? 1));
  const safePageSize = Math.min(
    100,
    Math.max(1, Math.trunc(query.pageSize ?? DEFAULT_MERCHANT_CAMPAIGNS_PAGE_SIZE)),
  );
  const params = new URLSearchParams({
    page: String(safePage),
    pageSize: String(safePageSize),
  });

  if (query.status) {
    params.set('status', query.status);
  }

  return apiRequest<PaginatedResponse<MerchantCampaign>>(
    `/merchant/campaigns?${params.toString()}`,
    {
      method: 'GET',
      auth: true,
      signal: query.signal,
    },
  );
}

/**
 * GET /api/v1/merchant/campaigns/:campaignId
 * Fetches full campaign detail including reserve usage and performance stats.
 */
export async function fetchMerchantCampaignById(
  campaignId: string,
): Promise<MerchantCampaign> {
  return apiRequest<MerchantCampaign>(
    `/merchant/campaigns/${encodeURIComponent(campaignId)}`,
    {
      method: 'GET',
      auth: true,
    },
  );
}

/**
 * POST /api/v1/merchant/campaigns/:campaignId/close
 * Ends the campaign immediately and releases any unused locked reserve to available wallet balance.
 */
export async function closeMerchantCampaign(
  campaignId: string,
): Promise<MerchantCampaign> {
  return apiRequest<MerchantCampaign>(
    `/merchant/campaigns/${encodeURIComponent(campaignId)}/close`,
    {
      method: 'POST',
      auth: true,
    },
  );
}
