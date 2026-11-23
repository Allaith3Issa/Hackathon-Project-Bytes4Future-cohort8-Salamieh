import { HttpStatus } from '@nestjs/common';
import { apiError } from './api-error';

/** Maximum safe JSON integer for whole Syrian Pounds. */
export const MAX_MONEY_SYP = 9_007_199_254_740_991n;

export function parseSyp(value: string | number | bigint): bigint {
  let amount: bigint;
  try {
    amount = BigInt(value);
  } catch {
    throw apiError(
      HttpStatus.CONFLICT,
      'AMOUNT_OUT_OF_RANGE',
      'A calculated amount is outside the supported SYP range.',
    );
  }
  if (amount < 0n || amount > MAX_MONEY_SYP) {
    throw apiError(
      HttpStatus.CONFLICT,
      'AMOUNT_OUT_OF_RANGE',
      'A calculated amount is outside the supported SYP range.',
    );
  }
  return amount;
}

function parseFixedSyp(value: string | number | bigint): bigint {
  if (typeof value === 'string') {
    const match = /^(\d+)(?:\.(0+))?$/.exec(value);
    if (!match) {
      throw apiError(
        HttpStatus.CONFLICT,
        'AMOUNT_OUT_OF_RANGE',
        'The campaign commission is not a whole SYP amount.',
      );
    }
    return parseSyp(match[1]);
  }
  return parseSyp(value);
}

export function sypNumber(value: bigint): number {
  return Number(parseSyp(value));
}

export function fixedPercentBasisPoints(value: string | number): bigint {
  const text = String(value);
  if (!/^(?:\d{1,3})(?:\.\d{1,2})?$/.test(text)) {
    throw apiError(
      HttpStatus.CONFLICT,
      'AMOUNT_OUT_OF_RANGE',
      'The campaign pricing configuration is invalid.',
    );
  }
  const [whole, fraction = ''] = text.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}

export function floorPercent(amount: bigint, basisPoints: bigint): bigint {
  return (amount * basisPoints) / 10_000n;
}

export function calculateOfferAmounts(input: {
  originalPriceSyp: string | number | bigint;
  discountPercent: string | number;
  fixedCommissionSyp: string | number | bigint;
}): {
  originalAmountSyp: bigint;
  customerPaidCashSyp: bigint;
  marketerCommissionSyp: bigint;
  platformTotalFeeSyp: bigint;
  customerCashbackSyp: bigint;
  platformNetFeeSyp: bigint;
  totalDeductedReserveSyp: bigint;
} {
  const originalAmountSyp = parseSyp(input.originalPriceSyp);
  const discountBasisPoints = fixedPercentBasisPoints(input.discountPercent);
  if (discountBasisPoints > 10_000n) {
    throw apiError(
      HttpStatus.CONFLICT,
      'AMOUNT_OUT_OF_RANGE',
      'The campaign pricing configuration is invalid.',
    );
  }

  const customerPaidCashSyp = floorPercent(
    originalAmountSyp,
    10_000n - discountBasisPoints,
  );
  const marketerCommissionSyp = parseFixedSyp(input.fixedCommissionSyp);
  const platformTotalFeeSyp = floorPercent(customerPaidCashSyp, 500n);
  const customerCashbackSyp = floorPercent(customerPaidCashSyp, 200n);
  const platformNetFeeSyp =
    platformTotalFeeSyp - customerCashbackSyp;
  const totalDeductedReserveSyp =
    marketerCommissionSyp + platformTotalFeeSyp;

  for (const amount of [
    customerPaidCashSyp,
    marketerCommissionSyp,
    platformTotalFeeSyp,
    customerCashbackSyp,
    platformNetFeeSyp,
    totalDeductedReserveSyp,
  ]) {
    parseSyp(amount);
  }

  return {
    originalAmountSyp,
    customerPaidCashSyp,
    marketerCommissionSyp,
    platformTotalFeeSyp,
    customerCashbackSyp,
    platformNetFeeSyp,
    totalDeductedReserveSyp,
  };
}

export function calculateStoreDiscountAmounts(input: {
  originalBillSyp: string | number | bigint;
  discountPercent: string | number;
  commissionPercent: string | number;
}): {
  originalAmountSyp: bigint;
  customerPaidCashSyp: bigint;
  marketerCommissionSyp: bigint;
  platformTotalFeeSyp: bigint;
  customerCashbackSyp: bigint;
  platformNetFeeSyp: bigint;
  totalDeductedReserveSyp: bigint;
} {
  const originalAmountSyp = parseSyp(input.originalBillSyp);
  const discountBasisPoints = fixedPercentBasisPoints(input.discountPercent);
  const commissionBasisPoints = fixedPercentBasisPoints(
    input.commissionPercent,
  );
  if (discountBasisPoints > 10_000n || commissionBasisPoints > 10_000n) {
    throw apiError(
      HttpStatus.CONFLICT,
      'AMOUNT_OUT_OF_RANGE',
      'The campaign pricing configuration is invalid.',
    );
  }

  const customerPaidCashSyp = floorPercent(
    originalAmountSyp,
    10_000n - discountBasisPoints,
  );
  const marketerCommissionSyp = floorPercent(
    customerPaidCashSyp,
    commissionBasisPoints,
  );
  const platformTotalFeeSyp = floorPercent(customerPaidCashSyp, 500n);
  const customerCashbackSyp = floorPercent(customerPaidCashSyp, 200n);
  const platformNetFeeSyp =
    platformTotalFeeSyp - customerCashbackSyp;
  const totalDeductedReserveSyp =
    marketerCommissionSyp + platformTotalFeeSyp;

  for (const amount of [
    customerPaidCashSyp,
    marketerCommissionSyp,
    platformTotalFeeSyp,
    customerCashbackSyp,
    platformNetFeeSyp,
    totalDeductedReserveSyp,
  ]) {
    parseSyp(amount);
  }

  return {
    originalAmountSyp,
    customerPaidCashSyp,
    marketerCommissionSyp,
    platformTotalFeeSyp,
    customerCashbackSyp,
    platformNetFeeSyp,
    totalDeductedReserveSyp,
  };
}

export function calculateVoucherCheckout(
  amountSyp: string | number | bigint,
  billTotalSyp: string | number | bigint,
): {
  amountSyp: bigint;
  billTotalSyp: bigint;
  customerPaidCashSyp: bigint;
} {
  const amount = parseSyp(amountSyp);
  const bill = parseSyp(billTotalSyp);
  if (amount === 0n || bill === 0n) {
    throw apiError(
      HttpStatus.BAD_REQUEST,
      'VALIDATION_ERROR',
      'Voucher and bill amounts must be positive.',
    );
  }
  if (bill < amount) {
    throw apiError(
      HttpStatus.CONFLICT,
      'VOUCHER_EXCEEDS_BILL',
      'The bill total must cover the cashback voucher amount.',
    );
  }
  return {
    amountSyp: amount,
    billTotalSyp: bill,
    customerPaidCashSyp: bill - amount,
  };
}
