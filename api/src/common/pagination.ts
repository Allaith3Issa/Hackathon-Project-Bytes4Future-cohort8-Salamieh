import { HttpStatus } from '@nestjs/common';
import { apiError } from './api-error';

export type PaginationInput = {
  page?: number;
  pageSize?: number;
};

export type Page<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  previousPage: number | null;
  nextPage: number | null;
};

export function normalizePagination(input: PaginationInput): {
  page: number;
  pageSize: number;
  offset: number;
} {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 20;
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 100 ||
    !Number.isSafeInteger((page - 1) * pageSize)
  ) {
    throw apiError(
      HttpStatus.BAD_REQUEST,
      'VALIDATION_ERROR',
      'Pagination values are outside the supported range.',
    );
  }
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function pageResult<T>(
  items: T[],
  page: number,
  pageSize: number,
  totalValue: string | number | bigint,
): Page<T> {
  const total = BigInt(totalValue);
  if (total < 0n || total > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw apiError(
      HttpStatus.CONFLICT,
      'AMOUNT_OUT_OF_RANGE',
      'A reported total is outside the supported range.',
    );
  }
  const totalNumber = Number(total);
  return {
    items,
    page,
    pageSize,
    total: totalNumber,
    previousPage: page > 1 ? page - 1 : null,
    nextPage:
      BigInt(page) * BigInt(pageSize) < total ? page + 1 : null,
  };
}
