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
let activeSignOutEpoch: number | null = null;
let pendingSignOutBlockEpoch: number | null = null;

export function getSessionEpoch(): number {
  return sessionEpoch;
}

export function bumpSessionEpoch(): number {
  sessionEpoch += 1;
  refreshInFlight = null;
  activeSignOutEpoch = null;
  pendingSignOutBlockEpoch = null;
  return sessionEpoch;
}

export function holdSignOutBlockingRefresh(): number {
  pendingSignOutBlockEpoch = sessionEpoch;
  return sessionEpoch;
}

export function beginSignOutGate(): number {
  const epoch = bumpSessionEpoch();
  activeSignOutEpoch = epoch;
  return epoch;
}

export function endSignOutGate(epoch: number): void {
  if (activeSignOutEpoch === epoch) {
    activeSignOutEpoch = null;
  }
  if (pendingSignOutBlockEpoch === epoch) {
    pendingSignOutBlockEpoch = null;
  }
}

export function isSignOutInProgress(): boolean {
  return (
    (activeSignOutEpoch !== null && activeSignOutEpoch === sessionEpoch) ||
    (pendingSignOutBlockEpoch !== null && pendingSignOutBlockEpoch === sessionEpoch)
  );
}

export async function awaitActiveRefresh(timeoutMs?: number): Promise<AuthSession | null> {
  const inFlight = refreshInFlight;
  if (!inFlight) {
    return null;
  }

  if (timeoutMs === undefined || timeoutMs <= 0) {
    try {
      return await inFlight;
    } catch {
      return null;
    }
  }

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<null>((resolve) => {
    timeoutId = setTimeout(() => {
      resolve(null);
    }, timeoutMs);
  });

  try {
    return await Promise.race([inFlight.catch(() => null), timeoutPromise]);
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
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
  if (isSignOutInProgress()) {
    return;
  }

  const clearingEpoch = sessionEpoch + 1;
  sessionEpoch = clearingEpoch;
  refreshInFlight = null;
  activeSignOutEpoch = null;
  pendingSignOutBlockEpoch = null;
  await tokenStorage.clearTokens();

  if (sessionEpoch !== clearingEpoch) {
    return;
  }

  swrCache.clear();
  sessionExpiredListener?.();
}

type HttpResponseLike = Pick<
  Response,
  'ok' | 'status' | 'statusText' | 'json' | 'text'
>;

function createAbortError(): Error {
  const err = new Error('Request aborted.');
  err.name = 'AbortError';
  return err;
}

function isLikelyFetchNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  // Expo WinterCG fetch wraps native network failures with "fetch failed: ...".
  if (
    error.name === 'FetchError' ||
    error.message.startsWith('fetch failed:')
  ) {
    return true;
  }

  if (error instanceof TypeError) {
    const msg = error.message.toLowerCase();
    // Preserve local programming/BodyInit mistakes instead of mislabeling as NETWORK_ERROR.
    if (msg.includes('unsupported')) {
      return false;
    }
    return true;
  }

  return false;
}

function createXhrResponse(
  status: number,
  statusText: string,
  responseText: string,
): HttpResponseLike {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    async text(): Promise<string> {
      return responseText;
    },
    async json(): Promise<unknown> {
      return JSON.parse(responseText) as unknown;
    },
  };
}

function executeMultipartXhr(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  headers: Record<string, string>,
  formData: FormData,
  timeoutMs: number,
  externalSignal?: AbortSignal,
): Promise<HttpResponseLike> {
  if (externalSignal?.aborted) {
    return Promise.reject(createAbortError());
  }

  if (typeof XMLHttpRequest === 'undefined') {
    return Promise.reject(
      new ApiClientError(0, 'UNKNOWN_ERROR', 'XMLHttpRequest is unavailable.'),
    );
  }

  return new Promise<HttpResponseLike>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;
    let timedOut = false;
    let abortedExternally = false;
    let safetyTimeoutId: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (safetyTimeoutId !== null) {
        clearTimeout(safetyTimeoutId);
        safetyTimeoutId = null;
      }
      externalSignal?.removeEventListener('abort', handleExternalAbort);
      xhr.onload = null;
      xhr.onerror = null;
      xhr.ontimeout = null;
      xhr.onabort = null;
    };

    const fail = (error: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };

    const failWithNetworkError = () => {
      if ((abortedExternally || externalSignal?.aborted) && !timedOut) {
        fail(createAbortError());
        return;
      }
      fail(new ApiClientError(0, 'NETWORK_ERROR', 'Network request failed.'));
    };

    const handleTimeout = () => {
      timedOut = true;
      try {
        xhr.abort();
      } catch {
        // Ignore abort errors from closed XHR instances.
      }
      fail(new ApiClientError(0, 'NETWORK_ERROR', 'Network request failed.'));
    };

    const handleExternalAbort = () => {
      abortedExternally = true;
      try {
        xhr.abort();
      } catch {
        // Ignore abort errors from closed XHR instances.
      }
      fail(createAbortError());
    };

    if (externalSignal) {
      externalSignal.addEventListener('abort', handleExternalAbort, { once: true });
    }

    if (timeoutMs > 0) {
      xhr.timeout = timeoutMs;
      safetyTimeoutId = setTimeout(handleTimeout, timeoutMs + 500);
    }

    xhr.onload = () => {
      if (settled) {
        return;
      }
      if ((abortedExternally || externalSignal?.aborted) && !timedOut) {
        fail(createAbortError());
        return;
      }
      if (xhr.status === 0) {
        failWithNetworkError();
        return;
      }
      settled = true;
      cleanup();
      const responseText =
        typeof xhr.responseText === 'string' ? xhr.responseText : '';
      resolve(createXhrResponse(xhr.status, xhr.statusText ?? '', responseText));
    };

    xhr.onerror = failWithNetworkError;
    xhr.ontimeout = handleTimeout;
    xhr.onabort = () => {
      if ((abortedExternally || externalSignal?.aborted) && !timedOut) {
        fail(createAbortError());
        return;
      }
      failWithNetworkError();
    };

    try {
      xhr.open(method, url, true);
      for (const [key, value] of Object.entries(headers)) {
        if (key.toLowerCase() === 'content-type') {
          continue;
        }
        xhr.setRequestHeader(key, value);
      }
      xhr.send(formData as unknown as XMLHttpRequestBodyInit);
    } catch (error: unknown) {
      if ((abortedExternally || externalSignal?.aborted) && !timedOut) {
        fail(createAbortError());
        return;
      }
      fail(
        error instanceof Error
          ? error
          : new ApiClientError(0, 'UNKNOWN_ERROR', 'Unexpected upload error.'),
      );
    }
  });
}

async function parseErrorPayload(
  response: HttpResponseLike,
): Promise<ApiErrorPayload | null> {
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
): Promise<HttpResponseLike> {
  if (!hasConfiguredApiUrl()) {
    throw new ApiClientError(
      0,
      'API_NOT_CONFIGURED',
      'EXPO_PUBLIC_API_URL is missing or invalid (https:// is required outside __DEV__).',
    );
  }

  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData;

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (options.body !== undefined && !isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  if (options.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey;
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const externalSignal = options.signal;

  if (isFormData) {
    return executeMultipartXhr(
      method,
      buildApiV1Url(path),
      headers,
      options.body as FormData,
      timeoutMs,
      externalSignal,
    );
  }

  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const abortFromExternal = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', abortFromExternal, { once: true });
    }
  }

  let requestBody: BodyInit | undefined;
  if (options.body !== undefined) {
    requestBody = JSON.stringify(options.body);
  }

  try {
    return await fetch(buildApiV1Url(path), {
      method,
      headers,
      body: requestBody,
      signal: controller.signal,
    });
  } catch (error: unknown) {
    if (externalSignal?.aborted && !timedOut) {
      throw createAbortError();
    }
    if (timedOut || isLikelyFetchNetworkError(error)) {
      throw new ApiClientError(0, 'NETWORK_ERROR', 'Network request failed.');
    }
    throw error instanceof Error
      ? error
      : new ApiClientError(0, 'UNKNOWN_ERROR', 'Unexpected request error.');
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
  if (isSignOutInProgress()) {
    return null;
  }

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
      bearerToken: options.bearerToken,
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
