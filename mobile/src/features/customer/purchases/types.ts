import type { PaginatedResponse } from '@/core/api';

/**
 * Customer purchase DTOs aligned 1:1 with CustomerPurchaseDto and CustomerPurchasePageDto
 * in api/src/reporting/dto/customer-reporting.dto.ts and API_CONTRACT.md.
 * Monetary fields ending in Syp are nonnegative integers in minor units (100 = 1.00 new SYP).
 */
export interface CustomerPurchase {
  saleId: string;
  shopName: string;
  productName: string;
  quantity: number;
  customerPaidCashSyp: number;
  cashbackEarnedSyp: number;
  scannedAt: string;
}

export type CustomerPurchasePage = PaginatedResponse<CustomerPurchase>;

export interface FetchCustomerPurchasesParams {
  page?: number;
  pageSize?: number;
}
