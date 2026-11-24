import { apiRequest } from '@/core/api';
import type { OfferQrPass, PublicOffer } from './types';

/**
 * GET /api/v1/public/referrals/{code}
 * Resolves an active referral offer without recording a click.
 */
export async function fetchPublicOffer(code: string): Promise<PublicOffer> {
  return apiRequest<PublicOffer>(`/public/referrals/${encodeURIComponent(code)}`, {
    method: 'GET',
    auth: false,
  });
}

/**
 * POST /api/v1/public/referrals/{code}/clicks
 * Sends an empty POST body per backend requireEmptyBody() contract.
 */
export async function recordReferralClick(code: string): Promise<void> {
  return apiRequest<void>(`/public/referrals/${encodeURIComponent(code)}/clicks`, {
    method: 'POST',
    auth: false,
  });
}

/**
 * POST /api/v1/customer/referrals/{code}/offer-qr
 * Issues or retrieves the signed-in customer's authoritative Offer QR pass.
 * Sends an empty POST body per backend requireEmptyBody() contract.
 */
export async function issueCustomerOfferQr(code: string): Promise<OfferQrPass> {
  return apiRequest<OfferQrPass>(
    `/customer/referrals/${encodeURIComponent(code)}/offer-qr`,
    {
      method: 'POST',
      auth: true,
    },
  );
}
