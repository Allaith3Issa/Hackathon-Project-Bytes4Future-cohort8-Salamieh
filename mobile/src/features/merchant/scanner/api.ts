import { apiRequest } from '@/core/api';
import type { OfferRedeemResult, ScannerLookupResult } from './types';

/**
 * POST /api/v1/merchant/scanner/lookup
 * Read-only preview of an Offer QR token or human-readable pass code before cash settlement.
 */
export async function lookupOfferCode(code: string): Promise<ScannerLookupResult> {
  return apiRequest<ScannerLookupResult>('/merchant/scanner/lookup', {
    method: 'POST',
    auth: true,
    body: { code },
  });
}

/**
 * POST /api/v1/merchant/scanner/redeem-offer
 * Atomically settles a single-item cash offer sale using a mandatory 36-char UUID Idempotency-Key.
 */
export async function redeemOfferCode(
  code: string,
  idempotencyKey: string,
): Promise<OfferRedeemResult> {
  return apiRequest<OfferRedeemResult>('/merchant/scanner/redeem-offer', {
    method: 'POST',
    auth: true,
    idempotencyKey,
    body: {
      code,
      quantity: 1,
    },
  });
}
