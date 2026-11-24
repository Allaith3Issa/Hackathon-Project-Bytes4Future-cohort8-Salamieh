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

import { logoutSession } from '../../features/auth/api';
import {
  apiRequest,
  bumpSessionEpoch,
  getSessionEpoch,
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
    bumpSessionEpoch();
    const [accessToken, refreshToken] = await Promise.all([
      tokenStorage.getAccessToken(),
      tokenStorage.getRefreshToken(),
    ]);

    await wipeLocalSession(false);
    setSessionExpiredNotice(false);

    if (!accessToken && !refreshToken) {
      return { serverLogoutFailed: false };
    }

    let serverLogoutFailed = false;
    try {
      await logoutSession(refreshToken, accessToken);
    } catch {
      serverLogoutFailed = true;
    }

    return { serverLogoutFailed };
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
