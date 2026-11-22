import { HttpStatus, Injectable, PipeTransform } from '@nestjs/common';
import { apiError } from './api-error';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class UuidParamPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!UUID_PATTERN.test(value)) {
      throw apiError(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'The route identifier must be a UUID.',
      );
    }
    return value;
  }
}
