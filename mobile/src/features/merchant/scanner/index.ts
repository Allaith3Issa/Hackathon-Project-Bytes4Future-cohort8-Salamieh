export { lookupOfferCode, redeemOfferCode } from './api';
export {
  invalidateMerchantPostRedeemCaches,
  useMerchantScanner,
} from './hooks';
export {
  normalizeScannerCode,
  SCANNER_CODE_MAX_LENGTH,
  SCANNER_CODE_REGEX,
} from './types';
export type {
  MerchantScannerSource,
  MerchantScannerStatus,
  OfferRedeemResult,
  ScannerCashbackVoucherLookupResult,
  ScannerLookupResult,
  ScannerOfferLookupResult,
  ScannerOfferQuantityOption,
} from './types';
