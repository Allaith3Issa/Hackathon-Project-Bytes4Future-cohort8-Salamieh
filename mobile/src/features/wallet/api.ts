import { apiRequest } from '@/core/api';
import type { MarketerWallet } from './types';

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
