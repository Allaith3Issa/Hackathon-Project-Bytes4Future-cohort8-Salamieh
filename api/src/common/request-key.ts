import { HttpStatus } from '@nestjs/common';
import { apiError } from './api-error';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateRequestKey(value: string | undefined): string {
  if (!value || !UUID_PATTERN.test(value)) {
    throw apiError(
      HttpStatus.BAD_REQUEST,
      'VALIDATION_ERROR',
      'Idempotency-Key must be a UUID.',
    );
  }
  return value.toLowerCase();
}
