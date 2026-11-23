import { HttpException, HttpStatus } from '@nestjs/common';

export type ApiErrorCode =
  | 'AMOUNT_OUT_OF_RANGE'
  | 'AUTH_REQUIRED'
  | 'CAMPAIGN_ENDED'
  | 'FORBIDDEN'
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'INSUFFICIENT_LOCKED_BUDGET'
  | 'INVALID_STATUS_TRANSITION'
  | 'MERCHANT_NOT_VERIFIED'
  | 'NOT_FOUND'
  | 'QR_ALREADY_REDEEMED'
  | 'QR_EXPIRED'
  | 'VALIDATION_ERROR';

export function apiError(
  status: HttpStatus,
  code: ApiErrorCode,
  message: string,
): HttpException {
  return new HttpException({ statusCode: status, code, message }, status);
}
