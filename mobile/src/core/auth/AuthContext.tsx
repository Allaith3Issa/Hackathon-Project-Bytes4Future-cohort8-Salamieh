import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';

import { logoutSession, refreshAuthSession } from '../../features/auth/api';
import {
  apiRequest,
  awaitActiveRefresh,
  beginSignOutGate,
  bumpSessionEpoch,
  endSignOutGate,
  getSessionEpoch,
  holdSignOutBlockingRefresh,
  isApiClientError,
  registerSessionExpiredListener,
  runSingleFlightRefresh,
} from '../api';
import { swrCache } from '../cache';
import { tokenStorage } from './tokenStorage';
import { getAvailableMobileRoles, hasCustomerRole, hasSupportedMobileRole } from './types';
import type { Account, AuthSession, MobileWorkspaceRole } from './types';

export type AuthStatus = 'hydrating' | 'unauthenticated' | 'authenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: Account | null;
  activeRole: MobileWorkspaceRole | null;
  availableRoles: MobileWorkspaceRole[];
  requiresRoleSelection: boolean;
  sessionExpiredNotice: boolean;
  hydrationError: unknown | null;
  pendingReferralCode: string | null;
  setPendingReferralCode: (code: string | null) => void;
  clearPendingReferralCode: () => void;
  retryHydration: () => void;
  clearSessionExpiredNotice: () => void;
  establishSession: (session: AuthSession) => Promise<boolean>;
  switchWorkspaceRole: (role: MobileWorkspaceRole) => Promise<boolean>;
  syncAccount: (account: Account) => void;
  signOut: () => Promise<{ serverLogoutFailed: boolean }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const LOGOUT_REQUEST_TIMEOUT_MS = 4_000;
const BASE64URL_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function decodeBase64UrlToString(segment: string): string | null {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  if (!normalized || normalized.length % 4 === 1) {
    return null;
  }
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  let output = '';

  for (let i = 0; i < padded.length; i += 4) {
    const c1 = BASE64URL_ALPHABET.indexOf(padded[i]);
    const c2 = BASE64URL_ALPHABET.indexOf(padded[i + 1]);
    const c3 = padded[i + 2] === '=' ? -1 : BASE64URL_ALPHABET.indexOf(padded[i + 2]);
    const c4 = padded[i + 3] === '=' ? -1 : BASE64URL_ALPHABET.indexOf(padded[i + 3]);

    if (c1 === -1 || c2 === -1 || (padded[i + 2] !== '=' && c3 === -1) || (padded[i + 3] !== '=' && c4 === -1)) {
      return null;
    }

    const b1 = (c1 << 2) | (c2 >> 4);
    output += String.fromCharCode(b1);

    if (c3 !== -1) {
      const b2 = ((c2 & 0x0f) << 4) | (c3 >> 2);
      output += String.fromCharCode(b2);
      if (c4 !== -1) {
        const b3 = ((c3 & 0x03) << 6) | c4;
        output += String.fromCharCode(b3);
      }
    }
  }

  return output;
}

function isAccessTokenExpired(token: string, skewMs = 5_000): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return false;
  }

  const decodedPayload = decodeBase64UrlToString(parts[1]);
  if (!decodedPayload) {
    return false;
  }

  try {
    const parsed = JSON.parse(decodedPayload) as { exp?: unknown };
    if (typeof parsed.exp !== 'number' || !Number.isFinite(parsed.exp)) {
      return false;
    }
    return Date.now() >= parsed.exp * 1000 - skewMs;
  } catch {
    return false;
  }
}

function isDefinitiveAuthRejection(error: unknown): boolean {
  if (!isApiClientError(error)) {
    return false;
  }
  return (
    error.statusCode === 401 ||
    error.statusCode === 403 ||
    error.code === 'AUTH_REQUIRED' ||
    error.code === 'SESSION_EXPIRED' ||
    error.code === 'REFRESH_TOKEN_INVALID'
  );
}

async function resolveInitialWorkspaceRole(
  account: Account,
  preferCustomerOnPendingReferral = false,
): Promise<MobileWorkspaceRole | null> {
  const roles = getAvailableMobileRoles(account);
  if (roles.length === 0) {
    return null;
  }

  if (roles.length === 1) {
    const onlyRole = roles[0];
    await tokenStorage.saveActiveRole(account.id, onlyRole);
    return onlyRole;
  }

  const storedRole = await tokenStorage.getActiveRole(account.id);
  if (storedRole && roles.includes(storedRole)) {
    if (
      preferCustomerOnPendingReferral &&
      storedRole !== 'customer' &&
      hasCustomerRole(account)
    ) {
      await tokenStorage.saveActiveRole(account.id, 'customer');
      return 'customer';
    }
    return storedRole;
  }

  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('hydrating');
  const [user, setUser] = useState<Account | null>(null);
  const [activeRole, setActiveRole] = useState<MobileWorkspaceRole | null>(null);
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState(false);
  const [hydrationError, setHydrationError] = useState<unknown | null>(null);
  const [hydrationAttempt, setHydrationAttempt] = useState(0);
  const [pendingReferralCode, setPendingReferralCodeState] = useState<string | null>(null);

  const userRef = useRef<Account | null>(null);
  userRef.current = user;
  const pendingReferralCodeRef = useRef<string | null>(null);
  pendingReferralCodeRef.current = pendingReferralCode;
  const switchingRoleRef = useRef(false);
  const signingOutRef = useRef(false);

  const wipeLocalSession = useCallback(async (markExpired: boolean) => {
    await tokenStorage.clearTokens();
    swrCache.clear();
    userRef.current = null;
    setHydrationError(null);
    setUser(null);
    setActiveRole(null);
    setStatus('unauthenticated');
    if (markExpired) {
      setSessionExpiredNotice(true);
    }
  }, []);

  useEffect(() => {
    return registerSessionExpiredListener(() => {
      userRef.current = null;
      setHydrationError(null);
      setUser(null);
      setActiveRole(null);
      setStatus('unauthenticated');
      setSessionExpiredNotice(true);
    });
  }, []);

  useEffect(() => {
    let active = true;

    async function hydrateSession() {
      const startEpoch = getSessionEpoch();
      const [accessToken, refreshToken] = await Promise.all([
        tokenStorage.getAccessToken(),
        tokenStorage.getRefreshToken(),
      ]);

      if (!active || getSessionEpoch() !== startEpoch) {
        return;
      }

      if (!accessToken && !refreshToken) {
        userRef.current = null;
        setHydrationError(null);
        setUser(null);
        setActiveRole(null);
        setStatus('unauthenticated');
        return;
      }

      try {
        if (!accessToken && refreshToken) {
          const refreshed = await runSingleFlightRefresh();
          if (!active || getSessionEpoch() !== startEpoch) {
            return;
          }
          if (!refreshed || !hasSupportedMobileRole(refreshed.user)) {
            await wipeLocalSession(Boolean(refreshed));
            return;
          }
          const initialRole = await resolveInitialWorkspaceRole(refreshed.user);
          if (!active || getSessionEpoch() !== startEpoch) {
            return;
          }
          userRef.current = refreshed.user;
          setHydrationError(null);
          setUser(refreshed.user);
          setActiveRole(initialRole);
          setStatus('authenticated');
          return;
        }

        const account = await apiRequest<Account>('/auth/me');
        if (!active || getSessionEpoch() !== startEpoch) {
          return;
        }
        if (!hasSupportedMobileRole(account)) {
          await wipeLocalSession(false);
          return;
        }

        const initialRole = await resolveInitialWorkspaceRole(account);
        if (!active || getSessionEpoch() !== startEpoch) {
          return;
        }
        userRef.current = account;
        setHydrationError(null);
        setUser(account);
        setActiveRole(initialRole);
        setStatus('authenticated');
      } catch (error: unknown) {
        if (!active || getSessionEpoch() !== startEpoch) {
          return;
        }
        if (isDefinitiveAuthRejection(error)) {
          await wipeLocalSession(true);
          return;
        }
        // Keep SecureStore tokens intact on transient network/5xx/config errors and expose retry UI.
        setHydrationError(error);
      }
    }

    void hydrateSession();

    return () => {
      active = false;
    };
  }, [hydrationAttempt, wipeLocalSession]);

  const retryHydration = useCallback(() => {
    setHydrationError(null);
    setStatus('hydrating');
    setHydrationAttempt((prev) => prev + 1);
  }, []);

  const establishSession = useCallback(
    async (session: AuthSession): Promise<boolean> => {
      const nextEpoch = bumpSessionEpoch();

      if (!hasSupportedMobileRole(session.user)) {
        await wipeLocalSession(false);
        return false;
      }

      swrCache.clear();
      await tokenStorage.saveTokens({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
      });

      if (getSessionEpoch() !== nextEpoch) {
        return false;
      }

      const initialRole = await resolveInitialWorkspaceRole(
        session.user,
        Boolean(pendingReferralCodeRef.current),
      );
      if (getSessionEpoch() !== nextEpoch) {
        return false;
      }

      userRef.current = session.user;
      setHydrationError(null);
      setSessionExpiredNotice(false);
      setUser(session.user);
      setActiveRole(initialRole);
      setStatus('authenticated');
      return true;
    },
    [wipeLocalSession],
  );

  const switchWorkspaceRole = useCallback(
    async (nextRole: MobileWorkspaceRole): Promise<boolean> => {
      if (switchingRoleRef.current) {
        return false;
      }
      if (status !== 'authenticated' || !user || !user.roles.includes(nextRole)) {
        return false;
      }

      if (activeRole === nextRole) {
        return true;
      }

      switchingRoleRef.current = true;
      const targetUserId = user.id;
      const nextEpoch = bumpSessionEpoch();

      try {
        swrCache.clear();
        await tokenStorage.saveActiveRole(targetUserId, nextRole);

        if (getSessionEpoch() !== nextEpoch) {
          return false;
        }

        setActiveRole(nextRole);
        return true;
      } finally {
        switchingRoleRef.current = false;
      }
    },
    [activeRole, status, user],
  );

  const syncAccount = useCallback((nextAccount: Account) => {
    const current = userRef.current;
    if (!current || current.id !== nextAccount.id || !hasSupportedMobileRole(nextAccount)) {
      return;
    }

    userRef.current = nextAccount;
    setUser(nextAccount);
    setActiveRole((currentRole) =>
      currentRole && nextAccount.roles.includes(currentRole) ? currentRole : null,
    );
  }, []);

  const signOut = useCallback(async (): Promise<{ serverLogoutFailed: boolean }> => {
    if (signingOutRef.current) {
      return { serverLogoutFailed: false };
    }
    signingOutRef.current = true;
    const preSignOutEpoch = holdSignOutBlockingRefresh();
    let logoutEpoch: number | null = null;
    let serverLogoutFailed = false;

    try {
      const preRefreshed = await awaitActiveRefresh(LOGOUT_REQUEST_TIMEOUT_MS);
      if (getSessionEpoch() !== preSignOutEpoch) {
        return { serverLogoutFailed: false };
      }

      logoutEpoch = beginSignOutGate();

      const revokeWithRefresh = async (currentRefreshToken: string): Promise<void> => {
        const refreshed = await refreshAuthSession(currentRefreshToken, {
          timeoutMs: LOGOUT_REQUEST_TIMEOUT_MS,
        });
        await logoutSession(refreshed.refreshToken, refreshed.accessToken, {
          timeoutMs: LOGOUT_REQUEST_TIMEOUT_MS,
        });
      };

      const revokeWithAccessOrFallback = async (
        currentAccessToken: string,
        currentRefreshToken: string | null,
      ): Promise<void> => {
        try {
          await logoutSession(currentRefreshToken, currentAccessToken, {
            timeoutMs: LOGOUT_REQUEST_TIMEOUT_MS,
          });
        } catch (error: unknown) {
          const shouldRefreshOnAuthError =
            isApiClientError(error) &&
            error.statusCode === 401 &&
            (error.code === 'AUTH_REQUIRED' || error.code === 'SESSION_EXPIRED');

          if (shouldRefreshOnAuthError && currentRefreshToken) {
            await revokeWithRefresh(currentRefreshToken);
          } else {
            throw error;
          }
        }
      };

      if (preRefreshed) {
        try {
          await revokeWithAccessOrFallback(
            preRefreshed.accessToken,
            preRefreshed.refreshToken,
          );
        } catch (error: unknown) {
          if (
            isApiClientError(error) &&
            (error.code === 'REFRESH_TOKEN_INVALID' || error.code === 'SESSION_EXPIRED')
          ) {
            serverLogoutFailed = false;
          } else {
            serverLogoutFailed = true;
          }
        }
        return { serverLogoutFailed };
      }

      const [accessToken, refreshToken] = await Promise.all([
        tokenStorage.getAccessToken(),
        tokenStorage.getRefreshToken(),
      ]);

      if (!accessToken && !refreshToken) {
        return { serverLogoutFailed: false };
      }

      try {
        if (accessToken && !isAccessTokenExpired(accessToken)) {
          await revokeWithAccessOrFallback(accessToken, refreshToken);
        } else if (refreshToken) {
          await revokeWithRefresh(refreshToken);
        } else {
          serverLogoutFailed = true;
        }
      } catch (error: unknown) {
        if (
          isApiClientError(error) &&
          (error.code === 'REFRESH_TOKEN_INVALID' || error.code === 'SESSION_EXPIRED')
        ) {
          serverLogoutFailed = false;
        } else {
          serverLogoutFailed = true;
        }
      }

      return { serverLogoutFailed };
    } finally {
      if (logoutEpoch !== null) {
        endSignOutGate(logoutEpoch);
        if (getSessionEpoch() === logoutEpoch) {
          await wipeLocalSession(false);
          setSessionExpiredNotice(false);
        }
      } else {
        endSignOutGate(preSignOutEpoch);
      }
      signingOutRef.current = false;
    }
  }, [wipeLocalSession]);

  const clearSessionExpiredNotice = useCallback(() => {
    setSessionExpiredNotice(false);
  }, []);

  const setPendingReferralCode = useCallback((code: string | null) => {
    const normalized = code?.trim() || null;
    pendingReferralCodeRef.current = normalized;
    setPendingReferralCodeState(normalized);
  }, []);

  const clearPendingReferralCode = useCallback(() => {
    pendingReferralCodeRef.current = null;
    setPendingReferralCodeState(null);
  }, []);

  const availableRoles = useMemo(() => getAvailableMobileRoles(user), [user]);
  const requiresRoleSelection = status === 'authenticated' && activeRole === null;

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      activeRole,
      availableRoles,
      requiresRoleSelection,
      sessionExpiredNotice,
      hydrationError,
      pendingReferralCode,
      setPendingReferralCode,
      clearPendingReferralCode,
      retryHydration,
      clearSessionExpiredNotice,
      establishSession,
      switchWorkspaceRole,
      syncAccount,
      signOut,
    }),
    [
      activeRole,
      availableRoles,
      clearPendingReferralCode,
      clearSessionExpiredNotice,
      establishSession,
      hydrationError,
      pendingReferralCode,
      requiresRoleSelection,
      retryHydration,
      sessionExpiredNotice,
      setPendingReferralCode,
      signOut,
      status,
      switchWorkspaceRole,
      syncAccount,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
