import { ApiClientError, apiRequest } from '@/core/api';
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

export interface CampaignImageUploadAsset {
  uri: string;
  mimeType: string;
  fileName: string;
}

export interface UploadCampaignImageResponse {
  imageUrl: string;
}

const IMAGE_UPLOAD_TIMEOUT_MS = 30_000;

function normalizeImageMimeType(rawMimeType: string): string {
  const normalized = rawMimeType.trim().toLowerCase();
  if (!normalized || normalized === 'image/jpg') {
    return 'image/jpeg';
  }
  return normalized;
}

function normalizeImageFileName(rawFileName: string, mimeType: string): string {
  const trimmed = rawFileName.trim();
  if (trimmed.length > 0) {
    return trimmed;
  }
  if (mimeType === 'image/png') {
    return 'campaign-product.png';
  }
  if (mimeType === 'image/webp') {
    return 'campaign-product.webp';
  }
  return 'campaign-product.jpg';
}

/**
 * POST /api/v1/merchant/uploads/image
 * Uploads a single compressed static JPEG/PNG/WebP image in the 'file' field
 * (strictly 1 file, 0 extra fields) and returns the CDN imageUrl.
 */
export async function uploadMerchantCampaignImage(
  asset: CampaignImageUploadAsset,
  signal?: AbortSignal,
): Promise<UploadCampaignImageResponse> {
  const uri = asset.uri.trim();
  if (!uri) {
    throw new ApiClientError(
      400,
      'VALIDATION_ERROR',
      'Submit exactly one valid, static image in the file field.',
    );
  }

  const mimeType = normalizeImageMimeType(asset.mimeType);
  const fileName = normalizeImageFileName(asset.fileName, mimeType);

  const formData = new FormData();
  formData.append('file', {
    uri,
    name: fileName,
    type: mimeType,
  } as unknown as Blob);

  return apiRequest<UploadCampaignImageResponse>('/merchant/uploads/image', {
    method: 'POST',
    auth: true,
    body: formData,
    signal,
    timeoutMs: IMAGE_UPLOAD_TIMEOUT_MS,
  });
}
