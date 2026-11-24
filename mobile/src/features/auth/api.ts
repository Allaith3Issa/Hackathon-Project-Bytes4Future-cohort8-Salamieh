import { apiRequest } from '@/core/api';
import type { Account, AuthSession, LoginRequest, RegisterRequest } from './types';

/**
 * POST /api/v1/auth/login
 * Authenticates a marketer or merchant with Syrian phone (^09[0-9]{8}$) and password.
 */
export async function loginWithPassword(payload: LoginRequest): Promise<AuthSession> {
  return apiRequest<AuthSession>('/auth/login', {
    method: 'POST',
    auth: false,
    body: {
      phone: payload.phone.trim(),
      password: payload.password,
    },
  });
}

/**
 * POST /api/v1/auth/register
 * Registers a marketer and/or merchant account matching RegisterDto.
 * Omits `shop` completely unless `roles` includes `'merchant'`.
 */
export async function registerAccount(payload: RegisterRequest): Promise<AuthSession> {
  const distinctRoles = Array.from(new Set(payload.roles));
  const includesMerchant = distinctRoles.includes('merchant');
  const body: RegisterRequest = {
    name: payload.name.trim(),
    phone: payload.phone.trim(),
    password: payload.password,
    roles: distinctRoles,
    ...(includesMerchant && payload.shop
      ? {
          shop: {
            name: payload.shop.name.trim(),
            details: payload.shop.details.trim(),
          },
        }
      : {}),
  };

  return apiRequest<AuthSession>('/auth/register', {
    method: 'POST',
    auth: false,
    body,
  });
}

/**
 * GET /api/v1/auth/me
 * Fetches the authenticated account profile from the server.
 */
export async function fetchCurrentAccount(): Promise<Account> {
  return apiRequest<Account>('/auth/me', {
    method: 'GET',
    auth: true,
  });
}

/**
 * POST /api/v1/auth/refresh
 * Exchanges a refresh token for a rotated AuthSession without triggering
 * global single-flight cache wipes or session-expired UI notices.
 */
export async function refreshAuthSession(
  refreshToken: string,
  options?: { timeoutMs?: number },
): Promise<AuthSession> {
  return apiRequest<AuthSession>('/auth/refresh', {
    method: 'POST',
    auth: false,
    skipRefreshOn401: true,
    timeoutMs: options?.timeoutMs,
    body: { refreshToken },
  });
}

/**
 * POST /api/v1/auth/logout
 * Revokes the active refresh token on the server without triggering token refresh on 401.
 */
export async function logoutSession(
  refreshToken?: string | null,
  accessToken?: string | null,
  options?: { timeoutMs?: number },
): Promise<void> {
  await apiRequest<void>('/auth/logout', {
    method: 'POST',
    auth: true,
    skipRefreshOn401: true,
    bearerToken: accessToken !== undefined ? accessToken : undefined,
    timeoutMs: options?.timeoutMs,
    body: refreshToken ? { refreshToken } : {},
  });
}
