import { tokenStorage } from '../auth/tokenStorage';
import { hasSupportedMobileRole } from '../auth/types';
import type { AuthSession } from '../auth/types';
import { swrCache } from '../cache';
import { buildApiV1Url, env, hasConfiguredApiUrl } from '../config';
import { ApiClientError } from './errors';
import type { ApiErrorPayload, ApiRequestOptions } from './types';

type SandboxModule = typeof import('../dev');

const DEFAULT_TIMEOUT_MS = 15_000;

let refreshInFlight: Promise<AuthSession | null> | null = null;
let sessionExpiredListener: (() => void) | null = null;
let sessionEpoch = 0;

export function getSessionEpoch(): number {
  return sessionEpoch;
}

export function bumpSessionEpoch(): number {
  sessionEpoch += 1;
  refreshInFlight = null;
  return sessionEpoch;
}

export function registerSessionExpiredListener(listener: () => void): () => void {
  sessionExpiredListener = listener;
  return () => {
    if (sessionExpiredListener === listener) {
      sessionExpiredListener = null;
    }
  };
}

function isDefinitiveAuthError(error: ApiClientError): boolean {
  return (
    error.statusCode === 401 ||
    error.statusCode === 403 ||
    error.code === 'REFRESH_TOKEN_INVALID' ||
    error.code === 'AUTH_REQUIRED' ||
    error.code === 'SESSION_EXPIRED'
  );
}

async function clearAuthAndCache(expectedEpoch?: number): Promise<void> {
  if (expectedEpoch !== undefined && sessionEpoch !== expectedEpoch) {
    return;
  }

  const clearingEpoch = sessionEpoch + 1;
  sessionEpoch = clearingEpoch;
  refreshInFlight = null;
  await tokenStorage.clearTokens();

  if (sessionEpoch !== clearingEpoch) {
    return;
  }

  swrCache.clear();
  sessionExpiredListener?.();
}

async function parseErrorPayload(response: Response): Promise<ApiErrorPayload | null> {
  try {
    const data = (await response.json()) as Partial<ApiErrorPayload> | null;
    if (data && typeof data === 'object' && typeof data.code === 'string') {
      return {
        statusCode: typeof data.statusCode === 'number' ? data.statusCode : response.status,
        code: data.code,
        message: typeof data.message === 'string' ? data.message : response.statusText,
        fieldErrors:
          data.fieldErrors && typeof data.fieldErrors === 'object'
            ? data.fieldErrors
            : undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function executeRawFetch(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  options: ApiRequestOptions,
  accessToken: string | null,
): Promise<Response> {
  if (!hasConfiguredApiUrl()) {
    throw new ApiClientError(
      0,
      'API_NOT_CONFIGURED',
      'EXPO_PUBLIC_API_URL is missing or invalid (https:// is required outside __DEV__).',
    );
  }

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const externalSignal = options.signal;
  const abortFromExternal = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', abortFromExternal, { once: true });
    }
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  if (options.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey;
  }

  try {
    return await fetch(buildApiV1Url(path), {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ApiClientError(0, 'NETWORK_ERROR', 'Network request failed.');
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', abortFromExternal);
  }
}

/**
 * Single-Flight Refresh Mutex:
 * Ensures concurrent 401 responses trigger at most one POST /auth/refresh call,
 * protecting against rotated refresh-token reuse rejection and cross-session races.
 */
export async function runSingleFlightRefresh(): Promise<AuthSession | null> {
  if (!(__DEV__ && env.useDevSandbox) && !hasConfiguredApiUrl()) {
    throw new ApiClientError(
      0,
      'API_NOT_CONFIGURED',
      'EXPO_PUBLIC_API_URL is missing or invalid (https:// is required outside __DEV__).',
    );
  }

  if (refreshInFlight) {
    return refreshInFlight;
  }

  const startEpoch = sessionEpoch;
  let currentPromise: Promise<AuthSession | null>;

  currentPromise = (async (): Promise<AuthSession | null> => {
    const refreshToken = await tokenStorage.getRefreshToken();
    if (sessionEpoch !== startEpoch) {
      return null;
    }

    if (!refreshToken) {
      await clearAuthAndCache(startEpoch);
      return null;
    }

    try {
      let nextSession: AuthSession;
      if (__DEV__ && env.useDevSandbox) {
        const { handleSandboxRequest } = require('../dev') as SandboxModule;
        nextSession = await handleSandboxRequest<AuthSession>('POST', '/auth/refresh', {
          refreshToken,
        });
      } else {
        const response = await executeRawFetch(
          'POST',
          '/auth/refresh',
          { body: { refreshToken } },
          null,
        );
        if (!response.ok) {
          const errorPayload = await parseErrorPayload(response);
          const apiError = new ApiClientError(
            errorPayload?.statusCode ?? response.status,
            errorPayload?.code ?? 'UNKNOWN_ERROR',
            errorPayload?.message ?? 'Session refresh failed.',
            errorPayload?.fieldErrors,
          );
          if (sessionEpoch !== startEpoch) {
            return null;
          }
          if (isDefinitiveAuthError(apiError)) {
            await clearAuthAndCache(startEpoch);
            return null;
          }
          throw apiError;
        }
        nextSession = (await response.json()) as AuthSession;
      }

      if (sessionEpoch !== startEpoch) {
        return null;
      }

      if (!hasSupportedMobileRole(nextSession.user)) {
        await clearAuthAndCache(startEpoch);
        return null;
      }

      await tokenStorage.saveTokens({
        accessToken: nextSession.accessToken,
        refreshToken: nextSession.refreshToken,
      });

      if (sessionEpoch !== startEpoch) {
        return null;
      }

      return nextSession;
    } catch (error: unknown) {
      if (sessionEpoch !== startEpoch) {
        return null;
      }
      if (error instanceof ApiClientError && isDefinitiveAuthError(error)) {
        await clearAuthAndCache(startEpoch);
        return null;
      }
      // Preserve tokens on network/5xx/rate-limit/transient parse errors so offline users are not signed out.
      throw error;
    }
  })().finally(() => {
    if (refreshInFlight === currentPromise) {
      refreshInFlight = null;
    }
  });

  refreshInFlight = currentPromise;
  return currentPromise;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const method = options.method ?? 'GET';
  const requiresAuth = options.auth ?? true;
  const allowRefreshOn401 = requiresAuth && !options.skipRefreshOn401;

  if (__DEV__ && env.useDevSandbox) {
    const { handleSandboxRequest } = require('../dev') as SandboxModule;
    return handleSandboxRequest<T>(method, path, options.body, {
      idempotencyKey: options.idempotencyKey,
      signal: options.signal,
    });
  }

  if (!hasConfiguredApiUrl()) {
    throw new ApiClientError(
      0,
      'API_NOT_CONFIGURED',
      'EXPO_PUBLIC_API_URL is missing or invalid (https:// is required outside __DEV__).',
    );
  }

  const accessToken =
    options.bearerToken !== undefined
      ? options.bearerToken
      : requiresAuth
        ? await tokenStorage.getAccessToken()
        : null;

  if (requiresAuth && !accessToken) {
    if (!allowRefreshOn401) {
      throw new ApiClientError(401, 'AUTH_REQUIRED', 'Authentication required.');
    }
    const requestEpoch = sessionEpoch;
    const refreshed = await runSingleFlightRefresh();
    if (sessionEpoch !== requestEpoch || !refreshed) {
      throw new ApiClientError(401, 'AUTH_REQUIRED', 'Authentication required.');
    }
    return apiRequestWithToken<T>(method, path, options, refreshed.accessToken, false);
  }

  return apiRequestWithToken<T>(method, path, options, accessToken, allowRefreshOn401);
}

async function apiRequestWithToken<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  options: ApiRequestOptions,
  accessToken: string | null,
  allowRefreshOn401: boolean,
): Promise<T> {
  const response = await executeRawFetch(method, path, options, accessToken);

  if (response.status === 401 && allowRefreshOn401) {
    const requestEpoch = sessionEpoch;
    const refreshed = await runSingleFlightRefresh();
    if (sessionEpoch !== requestEpoch || !refreshed) {
      throw new ApiClientError(401, 'SESSION_EXPIRED', 'Session expired.');
    }
    return apiRequestWithToken<T>(method, path, options, refreshed.accessToken, false);
  }

  if (!response.ok) {
    const errorPayload = await parseErrorPayload(response);
    throw new ApiClientError(
      errorPayload?.statusCode ?? response.status,
      errorPayload?.code ?? 'UNKNOWN_ERROR',
      errorPayload?.message ?? 'Request failed.',
      errorPayload?.fieldErrors,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}
