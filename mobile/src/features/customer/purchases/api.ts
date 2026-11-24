import { apiRequest } from '@/core/api';
import type {
  CustomerPurchasePage,
  FetchCustomerPurchasesParams,
} from './types';

export const DEFAULT_CUSTOMER_PURCHASES_PAGE_SIZE = 20;

/**
 * GET /api/v1/customer/purchases
 * Retrieves paginated verified customer purchases ordered newest first.
 */
export async function fetchCustomerPurchases({
  page = 1,
  pageSize = DEFAULT_CUSTOMER_PURCHASES_PAGE_SIZE,
}: FetchCustomerPurchasesParams = {}): Promise<CustomerPurchasePage> {
  const safePage = Number.isFinite(page) ? Math.max(1, Math.trunc(page)) : 1;
  const safePageSize = Number.isFinite(pageSize)
    ? Math.min(100, Math.max(1, Math.trunc(pageSize)))
    : DEFAULT_CUSTOMER_PURCHASES_PAGE_SIZE;

  const query = new URLSearchParams({
    page: String(safePage),
    pageSize: String(safePageSize),
  });

  return apiRequest<CustomerPurchasePage>(
    `/customer/purchases?${query.toString()}`,
    {
      method: 'GET',
      auth: true,
    },
  );
}
