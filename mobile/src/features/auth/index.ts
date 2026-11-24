export {
  fetchCurrentAccount,
  loginWithPassword,
  logoutSession,
  registerAccount,
} from './api';
export { useAccountRefresh, useLoginForm, useRegisterForm, useSignOut } from './hooks';
export {
  getAvailableMobileRoles,
  hasCustomerRole,
  hasMarketerRole,
  hasMerchantRole,
  hasSupportedMobileRole,
} from './types';
export type {
  Account,
  AuthSession,
  LoginFieldErrors,
  LoginRequest,
  LogoutRequest,
  MobileWorkspaceRole,
  RegisterFieldErrors,
  RegisterRequest,
  RegisterShopInput,
  Role,
  VerificationStatus,
} from './types';
export {
  getUtf8ByteLength,
  MAX_NAME_LENGTH,
  MAX_PASSWORD_UTF8_BYTES,
  MAX_SHOP_DETAILS_LENGTH,
  MAX_SHOP_NAME_LENGTH,
  normalizePhoneInput,
  SYRIAN_PHONE_REGEX,
  validateLoginInput,
  validateRegisterInput,
} from './validation';
export type {
  LoginValidationResult,
  RegisterFormInput,
  RegisterValidationResult,
} from './validation';
