import type { MobileWorkspaceRole } from '@/core/auth';
import type { TranslationDictionary } from '@/core/i18n';
import type {
  LoginFieldErrors,
  RegisterFieldErrors,
  RegisterRequest,
} from './types';

export const SYRIAN_PHONE_REGEX = /^09[0-9]{8}$/;
export const MAX_NAME_LENGTH = 120;
export const MAX_PASSWORD_UTF8_BYTES = 72;
export const MAX_SHOP_NAME_LENGTH = 120;
export const MAX_SHOP_DETAILS_LENGTH = 2000;

const ARABIC_INDIC_ZERO = 0x0660;
const EASTERN_ARABIC_ZERO = 0x06f0;

export function getUtf8ByteLength(value: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value).length;
  }

  let bytes = 0;
  for (const char of value) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (codePoint <= 0x7f) {
      bytes += 1;
    } else if (codePoint <= 0x7ff) {
      bytes += 2;
    } else if (codePoint <= 0xffff) {
      bytes += 3;
    } else {
      bytes += 4;
    }
  }
  return bytes;
}

/**
 * Normalize Arabic-Indic / Eastern Arabic numerals and strip whitespace
 * so users typing on Arabic Android keyboards validate cleanly against ^09[0-9]{8}$.
 */
export function normalizePhoneInput(rawPhone: string): string {
  const mappedDigits = Array.from(rawPhone, (char) => {
    const code = char.charCodeAt(0);
    if (code >= ARABIC_INDIC_ZERO && code <= ARABIC_INDIC_ZERO + 9) {
      return String(code - ARABIC_INDIC_ZERO);
    }
    if (code >= EASTERN_ARABIC_ZERO && code <= EASTERN_ARABIC_ZERO + 9) {
      return String(code - EASTERN_ARABIC_ZERO);
    }
    return char;
  }).join('');

  return mappedDigits.replace(/[\s-]+/g, '').trim();
}

export interface LoginValidationResult {
  normalizedPhone: string;
  fieldErrors: LoginFieldErrors;
  isValid: boolean;
}

export function validateLoginInput(
  rawPhone: string,
  password: string,
  t: TranslationDictionary,
): LoginValidationResult {
  const normalizedPhone = normalizePhoneInput(rawPhone);
  const fieldErrors: LoginFieldErrors = {};

  if (!normalizedPhone) {
    fieldErrors.phone = t.auth.phoneRequired;
  } else if (!SYRIAN_PHONE_REGEX.test(normalizedPhone)) {
    fieldErrors.phone = t.auth.phoneInvalid;
  }

  if (password.length === 0) {
    fieldErrors.password = t.auth.passwordRequired;
  } else if (getUtf8ByteLength(password) > MAX_PASSWORD_UTF8_BYTES) {
    fieldErrors.password = t.auth.passwordTooLong;
  }

  return {
    normalizedPhone,
    fieldErrors,
    isValid: !fieldErrors.phone && !fieldErrors.password,
  };
}

export interface RegisterFormInput {
  name: string;
  phone: string;
  password: string;
  roles: MobileWorkspaceRole[];
  shopName: string;
  shopDetails: string;
}

export interface RegisterValidationResult {
  normalizedPhone: string;
  fieldErrors: RegisterFieldErrors;
  payload: RegisterRequest | null;
  isValid: boolean;
}

export function validateRegisterInput(
  input: RegisterFormInput,
  t: TranslationDictionary,
): RegisterValidationResult {
  const trimmedName = input.name.trim();
  const normalizedPhone = normalizePhoneInput(input.phone);
  const distinctRoles = Array.from(
    new Set(
      input.roles.filter(
        (role): role is MobileWorkspaceRole =>
          role === 'customer' || role === 'marketer' || role === 'merchant',
      ),
    ),
  );
  const includesMerchant = distinctRoles.includes('merchant');
  const trimmedShopName = input.shopName.trim();
  const trimmedShopDetails = input.shopDetails.trim();

  const fieldErrors: RegisterFieldErrors = {};

  if (!trimmedName) {
    fieldErrors.name = t.auth.nameRequired;
  } else if (trimmedName.length > MAX_NAME_LENGTH) {
    fieldErrors.name = t.auth.nameTooLong;
  }

  if (!normalizedPhone) {
    fieldErrors.phone = t.auth.phoneRequired;
  } else if (!SYRIAN_PHONE_REGEX.test(normalizedPhone)) {
    fieldErrors.phone = t.auth.phoneInvalid;
  }

  if (input.password.length === 0) {
    fieldErrors.password = t.auth.passwordRequired;
  } else if (getUtf8ByteLength(input.password) > MAX_PASSWORD_UTF8_BYTES) {
    fieldErrors.password = t.auth.passwordTooLong;
  }

  if (distinctRoles.length === 0) {
    fieldErrors.roles = t.auth.roleRequired;
  }

  if (includesMerchant) {
    if (!trimmedShopName) {
      fieldErrors.shopName = t.auth.shopNameRequired;
    } else if (trimmedShopName.length > MAX_SHOP_NAME_LENGTH) {
      fieldErrors.shopName = t.auth.shopNameTooLong;
    }

    if (!trimmedShopDetails) {
      fieldErrors.shopDetails = t.auth.shopDetailsRequired;
    } else if (trimmedShopDetails.length > MAX_SHOP_DETAILS_LENGTH) {
      fieldErrors.shopDetails = t.auth.shopDetailsTooLong;
    }
  }

  const isValid =
    !fieldErrors.name &&
    !fieldErrors.phone &&
    !fieldErrors.password &&
    !fieldErrors.roles &&
    !fieldErrors.shopName &&
    !fieldErrors.shopDetails;

  const payload: RegisterRequest | null = isValid
    ? {
        name: trimmedName,
        phone: normalizedPhone,
        password: input.password,
        roles: distinctRoles,
        ...(includesMerchant
          ? {
              shop: {
                name: trimmedShopName,
                details: trimmedShopDetails,
              },
            }
          : {}),
      }
    : null;

  return {
    normalizedPhone,
    fieldErrors,
    payload,
    isValid,
  };
}
