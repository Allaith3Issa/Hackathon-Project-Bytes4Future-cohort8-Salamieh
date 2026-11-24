import { apiRequest } from '@/core/api';
import type { PaginatedResponse } from '@/core/api';
import type {
  MarketerMerchantEarnings,
  MarketerStats,
  MarketerWallet,
  MarketerWalletTransaction,
} from './types';

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
