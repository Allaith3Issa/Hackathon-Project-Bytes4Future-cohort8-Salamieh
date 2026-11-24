import { isSafeHttpUrl } from '@/core/api';
import type { TranslationDictionary } from '@/core/i18n';
import { parseNewSypToMinorUnits } from '@/core/rtl';
import type { CampaignPreviewInput, LaunchCampaignInput } from './types';

export const MAX_PRODUCT_NAME_LENGTH = 120;
export const MAX_CAMPAIGN_DESCRIPTION_LENGTH = 2000;
export const MAX_CAMPAIGN_IMAGE_URL_LENGTH = 2048;
export const MAX_ITEMS_LIMIT = 2_147_483_647;

const ARABIC_INDIC_ZERO = 0x0660;
const EASTERN_ARABIC_ZERO = 0x06f0;

function normalizeNumericDigits(raw: string): string {
  return Array.from(raw, (char) => {
    const code = char.charCodeAt(0);
    if (code >= ARABIC_INDIC_ZERO && code <= ARABIC_INDIC_ZERO + 9) {
      return String(code - ARABIC_INDIC_ZERO);
    }
    if (code >= EASTERN_ARABIC_ZERO && code <= EASTERN_ARABIC_ZERO + 9) {
      return String(code - EASTERN_ARABIC_ZERO);
    }
    return char;
  }).join('');
}

export interface CampaignDraftFormInput {
  productName: string;
  description: string;
  imageUrl: string;
  originalPrice: string;
  discountPercent: string;
  commissionAmount: string;
  maxItems: string;
  endsAt: string;
}

export interface CampaignDraftFieldErrors {
  productName?: string;
  description?: string;
  imageUrl?: string;
  originalPrice?: string;
  discountPercent?: string;
  commissionAmount?: string;
  maxItems?: string;
  endsAt?: string;
}

export interface CampaignDraftValidationResult {
  isValid: boolean;
  fieldErrors: CampaignDraftFieldErrors;
  previewInput: CampaignPreviewInput | null;
  launchInput: LaunchCampaignInput | null;
  normalizedEndsAt: string | null;
}

const FULL_RATE_BP = 10_000n;
const PLATFORM_FEE_BP = 500n;
const DAMASCUS_UTC_OFFSET_MS = 3 * 60 * 60 * 1000;

/**
 * Parse a decimal percentage (0..100, up to 2 fractional digits) into exact BigInt basis points (0..10_000).
 */
function parseDiscountBasisPoints(raw: string): bigint | null {
  const normalized = normalizeNumericDigits(raw)
    .trim()
    .replace(/\s+/g, '')
    .replace(/\u066B/g, '.');

  if (!normalized) {
    return null;
  }

  if (!/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(normalized)) {
    return null;
  }

  const [wholeRaw, fracRaw = ''] = normalized.split('.');
  const whole = wholeRaw.length > 0 ? wholeRaw : '0';
  const fracPadded = fracRaw.padEnd(2, '0');

  try {
    const basisPoints = BigInt(whole) * 100n + BigInt(fracPadded);
    if (basisPoints < 0n || basisPoints > FULL_RATE_BP) {
      return null;
    }
    return basisPoints;
  } catch {
    return null;
  }
}

/**
 * Parse a decimal percentage (0..100, up to 2 fractional digits, Arabic numerals supported).
 */
export function parseDiscountPercent(raw: string): number | null {
  const basisPoints = parseDiscountBasisPoints(raw);
  if (basisPoints === null) {
    return null;
  }
  return Number(basisPoints) / 100;
}

/**
 * Parse positive integer maxItems in 1..2_147_483_647.
 */
export function parsePositiveMaxItems(raw: string): number | null {
  const normalized = normalizeNumericDigits(raw).trim().replace(/\s+/g, '');
  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > MAX_ITEMS_LIMIT) {
    return null;
  }

  return parsed;
}

/**
 * Normalize either YYYY-MM-DD (interpreted as 23:59:59Z UTC on that day) or full ISO 8601
 * into a future UTC ISO 8601 timestamp string.
 */
export function normalizeCampaignEndsAtInput(raw: string): string | null {
  const trimmed = normalizeNumericDigits(raw).trim();
  if (!trimmed) {
    return null;
  }

  const candidate = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? `${trimmed}T23:59:59Z`
    : trimmed;

  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  if (parsed.getTime() <= Date.now()) {
    return null;
  }

  return parsed.toISOString();
}

export function getMinimumCampaignEndDate(): Date {
  const now = new Date();
  const localTomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0,
    0,
  );
  const utcTomorrow = new Date(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  );
  const damascusNow = new Date(now.getTime() + DAMASCUS_UTC_OFFSET_MS);
  const damascusTomorrow = new Date(
    damascusNow.getUTCFullYear(),
    damascusNow.getUTCMonth(),
    damascusNow.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  );
  const maxTime = Math.max(
    localTomorrow.getTime(),
    utcTomorrow.getTime(),
    damascusTomorrow.getTime(),
  );
  return new Date(maxTime);
}

export function buildEndOfDayIso(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const endOfDayUtc = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 0),
  );
  return endOfDayUtc.toISOString();
}

export function parseCampaignEndsAtToDate(rawEndsAt: string): Date {
  const normalized = normalizeNumericDigits(rawEndsAt).trim();
  const minDate = getMinimumCampaignEndDate();
  if (!normalized) {
    return minDate;
  }

  const candidate = /^\d{4}-\d{2}-\d{2}$/.test(normalized)
    ? `${normalized}T23:59:59Z`
    : normalized;
  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) {
    return minDate;
  }

  const calendarDay = new Date(
    parsed.getUTCFullYear(),
    parsed.getUTCMonth(),
    parsed.getUTCDate(),
    0,
    0,
    0,
    0,
  );
  return calendarDay.getTime() < minDate.getTime() ? minDate : calendarDay;
}

export function buildFutureIsoFromDays(daysFromNow: number): string {
  const damascusNow = new Date(Date.now() + DAMASCUS_UTC_OFFSET_MS);
  const endOfDayUtc = new Date(
    Date.UTC(
      damascusNow.getUTCFullYear(),
      damascusNow.getUTCMonth(),
      damascusNow.getUTCDate() + daysFromNow,
      23,
      59,
      59,
      0,
    ),
  );
  return endOfDayUtc.toISOString();
}

/**
 * Extract CampaignPreviewInput whenever the 4 numeric fields are valid
 * so live server preview updates automatically as the merchant types.
 */
export function parsePreviewInputFromDraft(
  draft: Pick<
    CampaignDraftFormInput,
    'originalPrice' | 'discountPercent' | 'commissionAmount' | 'maxItems'
  >,
): CampaignPreviewInput | null {
  const originalPriceSyp = parseNewSypToMinorUnits(draft.originalPrice, {
    allowZero: false,
  });
  const discountPercent = parseDiscountPercent(draft.discountPercent);
  const commissionAmountSyp = parseNewSypToMinorUnits(draft.commissionAmount, {
    allowZero: true,
  });
  const maxItems = parsePositiveMaxItems(draft.maxItems);

  if (
    originalPriceSyp === null ||
    discountPercent === null ||
    commissionAmountSyp === null ||
    maxItems === null
  ) {
    return null;
  }

  return {
    campaignType: 'product',
    originalPriceSyp,
    discountPercent,
    commission: { type: 'fixed', amountSyp: commissionAmountSyp },
    maxItems,
  };
}

export function validateCampaignDraft(
  draft: CampaignDraftFormInput,
  t: TranslationDictionary,
): CampaignDraftValidationResult {
  const fieldErrors: CampaignDraftFieldErrors = {};

  const trimmedProductName = draft.productName.trim();
  const trimmedDescription = draft.description.trim();
  const trimmedImageUrl = draft.imageUrl.trim();

  if (!trimmedProductName) {
    fieldErrors.productName = t.merchant.createCampaign.productNameRequired;
  } else if (trimmedProductName.length > MAX_PRODUCT_NAME_LENGTH) {
    fieldErrors.productName = t.merchant.createCampaign.productNameTooLong;
  }

  if (!trimmedDescription) {
    fieldErrors.description = t.merchant.createCampaign.descriptionRequired;
  } else if (trimmedDescription.length > MAX_CAMPAIGN_DESCRIPTION_LENGTH) {
    fieldErrors.description = t.merchant.createCampaign.descriptionTooLong;
  }

  if (!trimmedImageUrl) {
    fieldErrors.imageUrl = t.merchant.createCampaign.imageRequiredError;
  } else if (trimmedImageUrl.length > MAX_CAMPAIGN_IMAGE_URL_LENGTH) {
    fieldErrors.imageUrl = t.errors.IMAGE_UPLOAD_FAILED;
  } else if (!isSafeHttpUrl(trimmedImageUrl)) {
    fieldErrors.imageUrl = t.errors.IMAGE_UPLOAD_FAILED;
  }

  const originalPriceSyp = parseNewSypToMinorUnits(draft.originalPrice, {
    allowZero: false,
  });
  if (originalPriceSyp === null) {
    fieldErrors.originalPrice = t.merchant.createCampaign.originalPriceInvalid;
  }

  const discountBasisPoints = parseDiscountBasisPoints(draft.discountPercent);
  const discountPercent =
    discountBasisPoints !== null ? Number(discountBasisPoints) / 100 : null;
  if (discountPercent === null || discountBasisPoints === null) {
    fieldErrors.discountPercent = t.merchant.createCampaign.discountPercentInvalid;
  }

  const commissionAmountSyp = parseNewSypToMinorUnits(draft.commissionAmount, {
    allowZero: true,
  });
  if (commissionAmountSyp === null) {
    fieldErrors.commissionAmount = t.merchant.createCampaign.commissionInvalid;
  }

  if (
    originalPriceSyp !== null &&
    discountBasisPoints !== null &&
    !fieldErrors.originalPrice &&
    !fieldErrors.discountPercent
  ) {
    const finalPriceSyp =
      (BigInt(originalPriceSyp) * (FULL_RATE_BP - discountBasisPoints)) /
      FULL_RATE_BP;
    if (finalPriceSyp <= 0n) {
      fieldErrors.discountPercent =
        t.merchant.createCampaign.discountFinalPriceInvalid;
    } else if (
      commissionAmountSyp !== null &&
      !fieldErrors.commissionAmount
    ) {
      const platformTotalFeeSyp =
        (finalPriceSyp * PLATFORM_FEE_BP) / FULL_RATE_BP;
      const merchantNetSyp =
        finalPriceSyp - BigInt(commissionAmountSyp) - platformTotalFeeSyp;
      if (merchantNetSyp <= 0n) {
        fieldErrors.commissionAmount =
          t.merchant.createCampaign.commissionExceedsNetPrice;
      }
    }
  }

  const maxItems = parsePositiveMaxItems(draft.maxItems);
  if (maxItems === null) {
    fieldErrors.maxItems = t.merchant.createCampaign.maxItemsInvalid;
  }

  const normalizedEndsAt = normalizeCampaignEndsAtInput(draft.endsAt);
  if (!draft.endsAt.trim()) {
    fieldErrors.endsAt = t.merchant.createCampaign.endsAtRequired;
  } else if (!normalizedEndsAt) {
    fieldErrors.endsAt = t.merchant.createCampaign.endsAtPastOrInvalid;
  }

  const previewInput =
    originalPriceSyp !== null &&
    discountPercent !== null &&
    commissionAmountSyp !== null &&
    maxItems !== null
      ? ({
          campaignType: 'product',
          originalPriceSyp,
          discountPercent,
          commission: { type: 'fixed', amountSyp: commissionAmountSyp },
          maxItems,
        } satisfies CampaignPreviewInput)
      : null;

  const isValid =
    !fieldErrors.productName &&
    !fieldErrors.description &&
    !fieldErrors.imageUrl &&
    !fieldErrors.originalPrice &&
    !fieldErrors.discountPercent &&
    !fieldErrors.commissionAmount &&
    !fieldErrors.maxItems &&
    !fieldErrors.endsAt;

  const launchInput: LaunchCampaignInput | null =
    isValid && previewInput && normalizedEndsAt
      ? {
          ...previewInput,
          productName: trimmedProductName,
          description: trimmedDescription,
          imageUrl: trimmedImageUrl,
          endsAt: normalizedEndsAt,
          joinMode: 'open',
        }
      : null;

  return {
    isValid,
    fieldErrors,
    previewInput,
    launchInput,
    normalizedEndsAt,
  };
}
