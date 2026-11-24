import { apiRequest } from '@/core/api';
import type { MerchantDashboard } from './types';

/**
 * GET /api/v1/merchant/dashboard
 * Fetches authoritative merchant verification status, wallet balances, performance stats, and top campaign.
 */
export async function fetchMerchantDashboard(): Promise<MerchantDashboard> {
  return apiRequest<MerchantDashboard>('/merchant/dashboard', {
    method: 'GET',
    auth: true,
  });
}
