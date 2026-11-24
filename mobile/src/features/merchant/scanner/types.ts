import type { CampaignStatus, CampaignType } from '@/core/campaigns';

export const SCANNER_CODE_MAX_LENGTH = 128;
export const SCANNER_CODE_REGEX = /^[A-Za-z0-9_-]{1,128}$/;

export interface ScannerOfferQuantityOption {
  quantity: number;
  customerPaidCashSyp: number;
}

export interface ScannerOfferLookupResult {
  kind: 'offer_qr';
  passId: string;
  campaignId: string;
  campaignType: CampaignType;
  productName: string;
  customerName: string;
  discountPercent: number;
  finalPriceSyp: number | null;
  maxQuantity: number | null;
  availableQuantityOptions: ScannerOfferQuantityOption[];
  status: 'active';
}

export interface ScannerCashbackVoucherLookupResult {
  kind: 'cashback_voucher';
  voucherId: string;
  customerName: string;
  amountSyp: number;
  status: 'active';
}

export type ScannerLookupResult =
  | ScannerOfferLookupResult
  | ScannerCashbackVoucherLookupResult;

export interface OfferRedeemResult {
  saleId: string;
  campaignId: string;
  productName: string;
  quantity: number;
  originalAmountSyp: number;
  customerPaidCashSyp: number;
  marketerCommissionSyp: number;
  platformTotalFeeSyp: number;
  customerCashbackSyp: number;
  platformNetFeeSyp: number;
  remainingLockedBudgetSyp: number;
  campaignStatusAfterSale: CampaignStatus;
  scannedAt: string;
}

export type MerchantScannerStatus =
  | 'idle'
  | 'looking_up'
  | 'preview_ready'
  | 'redeeming'
  | 'redeemed'
  | 'error';

export type MerchantScannerSource = 'camera' | 'manual';

/**
 * Trim whitespace and verify the scanned or typed code matches backend DTO constraints:
 * ASCII letters, digits, '-' or '_' with length 1..128.
 */
export function normalizeScannerCode(raw: string): string | null {
  const trimmed = raw.trim();
  if (!SCANNER_CODE_REGEX.test(trimmed)) {
    return null;
  }
  return trimmed;
}
