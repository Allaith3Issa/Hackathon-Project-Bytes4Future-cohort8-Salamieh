import { getDictionary } from '../i18n';
import type { ApiErrorCodeKey, AppLocale } from '../i18n';

const KNOWN_ERROR_CODES = new Set<string>([
  'VALIDATION_ERROR',
  'AUTH_REQUIRED',
  'INVALID_CREDENTIALS',
  'REFRESH_TOKEN_INVALID',
  'SESSION_EXPIRED',
  'FORBIDDEN',
  'MERCHANT_NOT_VERIFIED',
  'SELF_PROMOTION_FORBIDDEN',
  'NOT_FOUND',
  'AMOUNT_OUT_OF_RANGE',
  'PHONE_ALREADY_REGISTERED',
  'CAMPAIGN_ENDED',
  'CAMPAIGN_LIMIT_EXCEEDED',
  'INSUFFICIENT_MERCHANT_BALANCE',
  'INSUFFICIENT_LOCKED_BUDGET',
  'INSUFFICIENT_CASHBACK_BALANCE',
  'INSUFFICIENT_WALLET_BALANCE',
  'JOIN_REQUEST_PENDING',
  'INVALID_STATUS_TRANSITION',
  'QR_ALREADY_REDEEMED',
  'QR_EXPIRED',
  'VOUCHER_EXCEEDS_BILL',
  'IDEMPOTENCY_KEY_REUSED',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'API_NOT_CONFIGURED',
  'NETWORK_ERROR',
  'UNKNOWN_ERROR',
]);

export class ApiClientError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export function isApiClientError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError;
}

export function mapApiErrorToMessage(error: unknown, locale: AppLocale): string {
  const dict = getDictionary(locale);

  if (isApiClientError(error)) {
    if (KNOWN_ERROR_CODES.has(error.code)) {
      return dict.errors[error.code as ApiErrorCodeKey];
    }
    if (error.statusCode === 0) {
      return dict.errors.NETWORK_ERROR;
    }
    if (error.statusCode === 401) {
      return dict.errors.SESSION_EXPIRED;
    }
    if (error.statusCode === 403) {
      return dict.errors.FORBIDDEN;
    }
    if (error.statusCode === 404) {
      return dict.errors.NOT_FOUND;
    }
    if (error.statusCode === 429) {
      return dict.errors.RATE_LIMITED;
    }
    if (error.statusCode >= 500) {
      return dict.errors.INTERNAL_ERROR;
    }
    return dict.errors.UNKNOWN_ERROR;
  }

  return dict.errors.UNKNOWN_ERROR;
}

export function extractFieldErrors(error: unknown): Record<string, string[]> {
  if (!isApiClientError(error) || !error.fieldErrors) {
    return {};
  }
  return error.fieldErrors;
}
