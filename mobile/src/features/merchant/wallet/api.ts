import { apiRequest } from '@/core/api';
import type { PaginatedResponse } from '@/core/api';
import type { MerchantWallet, MerchantWalletTransaction } from './types';

export const DEFAULT_MERCHANT_WALLET_PAGE_SIZE = 20;

/**
 * GET /api/v1/merchant/wallet
 * Retrieves authoritative merchant available and locked reserve balances (minor units).
 */
export async function fetchMerchantWallet(): Promise<MerchantWallet> {
  return apiRequest<MerchantWallet>('/merchant/wallet', {
    method: 'GET',
    auth: true,
  });
}

/**
 * GET /api/v1/merchant/wallet/transactions
 * Retrieves paginated merchant wallet ledger movements ordered newest first.
 */
export async function fetchMerchantWalletTransactions(
  page = 1,
  pageSize = DEFAULT_MERCHANT_WALLET_PAGE_SIZE,
): Promise<PaginatedResponse<MerchantWalletTransaction>> {
  const safePage = Math.max(1, Math.trunc(page));
  const safePageSize = Math.min(100, Math.max(1, Math.trunc(pageSize)));
  const query = new URLSearchParams({
    page: String(safePage),
    pageSize: String(safePageSize),
  });

  return apiRequest<PaginatedResponse<MerchantWalletTransaction>>(
    `/merchant/wallet/transactions?${query.toString()}`,
    {
      method: 'GET',
      auth: true,
    },
  );
}
