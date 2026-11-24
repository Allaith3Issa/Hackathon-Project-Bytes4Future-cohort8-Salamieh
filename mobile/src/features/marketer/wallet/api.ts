import { apiRequest } from '@/core/api';
import type { PaginatedResponse } from '@/core/api';
import type {
  CreateMarketerPayoutInput,
  FetchMarketerPayoutsParams,
  MarketerMerchantEarnings,
  MarketerPayout,
  MarketerStats,
  MarketerWallet,
  MarketerWalletTransaction,
  PayoutStatus,
} from './types';

const VALID_PAYOUT_STATUSES = new Set<PayoutStatus>([
  'pending_review',
  'confirmed',
  'rejected',
]);

export const DEFAULT_MARKETER_WALLET_PAGE_SIZE = 20;

/**
 * GET /api/v1/marketer/wallet
 * Retrieves authoritative marketer commission balance figures from the server.
 */
export async function fetchMarketerWallet(): Promise<MarketerWallet> {
  return apiRequest<MarketerWallet>('/marketer/wallet', {
    method: 'GET',
    auth: true,
  });
}

/**
 * GET /api/v1/marketer/stats
 * Retrieves authoritative aggregate clicks, items sold, earned minor units, and conversion rate.
 */
export async function fetchMarketerStats(): Promise<MarketerStats> {
  return apiRequest<MarketerStats>('/marketer/stats', {
    method: 'GET',
    auth: true,
  });
}

/**
 * GET /api/v1/marketer/wallet/by-merchant
 * Retrieves paginated marketer earnings grouped by merchant shop.
 */
export async function fetchMarketerEarningsByMerchant(
  page = 1,
  pageSize = DEFAULT_MARKETER_WALLET_PAGE_SIZE,
): Promise<PaginatedResponse<MarketerMerchantEarnings>> {
  const safePage = Math.max(1, Math.trunc(page));
  const safePageSize = Math.min(100, Math.max(1, Math.trunc(pageSize)));
  const query = new URLSearchParams({
    page: String(safePage),
    pageSize: String(safePageSize),
  });

  return apiRequest<PaginatedResponse<MarketerMerchantEarnings>>(
    `/marketer/wallet/by-merchant?${query.toString()}`,
    {
      method: 'GET',
      auth: true,
    },
  );
}

/**
 * GET /api/v1/marketer/wallet/transactions
 * Retrieves paginated marketer wallet ledger movements ordered newest first.
 */
export async function fetchMarketerWalletTransactions(
  page = 1,
  pageSize = DEFAULT_MARKETER_WALLET_PAGE_SIZE,
): Promise<PaginatedResponse<MarketerWalletTransaction>> {
  const safePage = Math.max(1, Math.trunc(page));
  const safePageSize = Math.min(100, Math.max(1, Math.trunc(pageSize)));
  const query = new URLSearchParams({
    page: String(safePage),
    pageSize: String(safePageSize),
  });

  return apiRequest<PaginatedResponse<MarketerWalletTransaction>>(
    `/marketer/wallet/transactions?${query.toString()}`,
    {
      method: 'GET',
      auth: true,
    },
  );
}

/**
 * GET /api/v1/marketer/payouts
 * Retrieves paginated marketer simulated payout requests ordered newest first.
 */
export async function fetchMarketerPayouts(
  params: FetchMarketerPayoutsParams = {},
): Promise<PaginatedResponse<MarketerPayout>> {
  const safePage = Math.max(1, Math.trunc(params.page ?? 1));
  const safePageSize = Math.min(
    100,
    Math.max(1, Math.trunc(params.pageSize ?? DEFAULT_MARKETER_WALLET_PAGE_SIZE)),
  );
  const query = new URLSearchParams({
    page: String(safePage),
    pageSize: String(safePageSize),
  });

  if (params.status && VALID_PAYOUT_STATUSES.has(params.status)) {
    query.set('status', params.status);
  }

  return apiRequest<PaginatedResponse<MarketerPayout>>(
    `/marketer/payouts?${query.toString()}`,
    {
      method: 'GET',
      auth: true,
      signal: params.signal,
    },
  );
}

/**
 * POST /api/v1/marketer/payouts
 * Submits a simulated full-balance marketer payout request with Idempotency-Key protection.
 */
export async function requestMarketerPayout(
  expectedAmountSyp: number,
  idempotencyKey: string,
): Promise<MarketerPayout> {
  const body: CreateMarketerPayoutInput = { expectedAmountSyp };

  return apiRequest<MarketerPayout>('/marketer/payouts', {
    method: 'POST',
    auth: true,
    body,
    idempotencyKey,
  });
}
