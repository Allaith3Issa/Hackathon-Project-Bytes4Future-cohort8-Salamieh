import type { MobileWorkspaceRole } from '@/core/auth';

export {
  getAvailableMobileRoles,
  hasCustomerRole,
  hasMarketerRole,
  hasMerchantRole,
  hasSupportedMobileRole,
} from '@/core/auth';
export type {
  Account,
  AuthSession,
  MobileWorkspaceRole,
  Role,
  VerificationStatus,
} from '@/core/auth';

export interface LoginRequest {
  phone: string;
  password: string;
}

export interface RegisterShopInput {
  name: string;
  details: string;
}

export interface RegisterRequest {
  name: string;
  phone: string;
  password: string;
  roles: MobileWorkspaceRole[];
  shop?: RegisterShopInput;
}

export interface LogoutRequest {
  refreshToken?: string;
}

export interface LoginFieldErrors {
  phone?: string;
  password?: string;
}

export interface RegisterFieldErrors {
  name?: string;
  phone?: string;
  password?: string;
  roles?: string;
  shopName?: string;
  shopDetails?: string;
}
