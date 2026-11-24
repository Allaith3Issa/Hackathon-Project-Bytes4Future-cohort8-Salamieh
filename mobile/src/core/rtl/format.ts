import type { AppLocale } from '../i18n/types';
import { isolateLtr } from './direction';

const MINOR_UNITS_SCALE = 100n;
const MAX_SAFE_MINOR_UNITS = BigInt(Number.MAX_SAFE_INTEGER);

const ARABIC_INDIC_ZERO = 0x0660;
const EASTERN_ARABIC_ZERO = 0x06f0;

function formatMajorIntegerWithGrouping(major: bigint): string {
  return major.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

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

/**
 * Format an authoritative backend SYP minor-unit integer (100 = 1.00 new SYP)
 * using exact integer division and remainder at scale 100 (zero float drift).
 */
export function formatSyp(amountMinorUnits: number, locale: AppLocale): string {
  const truncated = Number.isFinite(amountMinorUnits)
    ? Math.trunc(amountMinorUnits)
    : 0;
  const minorBigInt = BigInt(truncated);
  const isNegative = minorBigInt < 0n;
  const absMinor = isNegative ? -minorBigInt : minorBigInt;

  const major = absMinor / MINOR_UNITS_SCALE;
  const minor = absMinor % MINOR_UNITS_SCALE;
  const formattedNumeric = `${isNegative ? '-' : ''}${formatMajorIntegerWithGrouping(major)}.${minor.toString().padStart(2, '0')}`;

  if (locale === 'ar') {
    return `${isolateLtr(formattedNumeric)} ل.س.`;
  }
  return `${formattedNumeric} SYP`;
}

export interface ParseNewSypOptions {
  allowZero?: boolean;
}

/**
 * Parse a decimal new-SYP string (up to 2 fractional digits, supporting Arabic
 * numerals, "٫", and valid thousands separators like "1,500.50") into a
 * nonnegative/positive integer in minor units (scale 100) using pure integer arithmetic.
 */
export function parseNewSypToMinorUnits(
  input: string,
  options: ParseNewSypOptions = {},
): number | null {
  const allowZero = options.allowZero ?? false;
  const normalized = normalizeNumericDigits(input)
    .trim()
    .replace(/[\s_]/g, '')
    .replace(/\u066C/g, ',')
    .replace(/\u066B/g, '.');

  if (!normalized) {
    return null;
  }

  if (!/^(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?|\.\d{1,2})$/.test(normalized)) {
    return null;
  }

  const sanitized = normalized.replace(/,/g, '');
  const [wholePartRaw, fractionalPartRaw = ''] = sanitized.split('.');
  const wholePart = wholePartRaw.length > 0 ? wholePartRaw : '0';
  const fractionalPadded = fractionalPartRaw.padEnd(2, '0');

  try {
    const minorUnits =
      BigInt(wholePart) * MINOR_UNITS_SCALE + BigInt(fractionalPadded);

    if (minorUnits > MAX_SAFE_MINOR_UNITS) {
      return null;
    }

    if (allowZero ? minorUnits < 0n : minorUnits <= 0n) {
      return null;
    }

    return Number(minorUnits);
  } catch {
    return null;
  }
}

/**
 * Format a backend percentage value using Latin numerals (`0-9`) matching `formatSyp`
 * and locale-appropriate percent symbol.
 */
export function formatPercent(percent: number, locale: AppLocale): string {
  const safeValue = Number.isFinite(percent) ? percent : 0;
  let formattedNumber: string;

  try {
    const raw = new Intl.NumberFormat(
      locale === 'ar' ? 'ar-SY-u-nu-latn' : 'en-US',
      { maximumFractionDigits: 2, numberingSystem: 'latn' },
    ).format(safeValue);
    formattedNumber = normalizeNumericDigits(raw).replace(/\u066B/g, '.');
  } catch {
    const rounded = Math.round(safeValue * 100) / 100;
    formattedNumber = Number.isInteger(rounded)
      ? String(rounded)
      : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  }

  if (locale === 'ar') {
    return `${isolateLtr(formattedNumber)}٪`;
  }
  return `${formattedNumber}%`;
}

/**
 * Format a UTC ISO 8601 timestamp returned by NestJS on the UTC calendar date
 * (`timeZone: 'UTC'`) with consistent Latin numerals across Arabic and English.
 */
export function formatCampaignDate(isoDate: string, locale: AppLocale): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }

  try {
    const formatted = new Intl.DateTimeFormat(
      locale === 'ar' ? 'ar-SY-u-nu-latn' : 'en-US',
      {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
        numberingSystem: 'latn',
      },
    ).format(parsed);
    return normalizeNumericDigits(formatted);
  } catch {
    return parsed.toISOString().slice(0, 10);
  }
}
