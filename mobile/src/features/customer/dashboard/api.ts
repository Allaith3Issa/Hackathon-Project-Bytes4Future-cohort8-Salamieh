import { apiRequest } from '@/core/api';
import type { CustomerDashboard } from './types';

/**
 * GET /api/v1/customer/dashboard
 * Fetches authoritative customer cashback balances and milestone progress (zero frontend arithmetic).
 */
export async function fetchCustomerDashboard(): Promise<CustomerDashboard> {
  return apiRequest<CustomerDashboard>('/customer/dashboard', {
    method: 'GET',
    auth: true,
  });
}
