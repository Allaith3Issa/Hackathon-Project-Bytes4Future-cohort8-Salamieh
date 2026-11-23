import { HttpException, HttpStatus } from '@nestjs/common';

export type ApiErrorCode =
  | 'AMOUNT_OUT_OF_RANGE'
  | 'AUTH_REQUIRED'
  | 'CAMPAIGN_ENDED'
  | 'CAMPAIGN_LIMIT_EXCEEDED'
  | 'FORBIDDEN'
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'INSUFFICIENT_CASHBACK_BALANCE'
  | 'INSUFFICIENT_LOCKED_BUDGET'
  | 'INSUFFICIENT_WALLET_BALANCE'
  | 'INVALID_STATUS_TRANSITION'
  | 'MERCHANT_NOT_VERIFIED'
  | 'NOT_FOUND'
  | 'QR_ALREADY_REDEEMED'
  | 'QR_EXPIRED'
  | 'VOUCHER_EXCEEDS_BILL'
  | 'VALIDATION_ERROR';

export function apiError(
  status: HttpStatus,
  code: ApiErrorCode,
  message: string,
): HttpException {
  return new HttpException({ statusCode: status, code, message }, status);
}
