import { useFocusEffect, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';

import { mapApiErrorToMessage } from '@/core/api';
import { useAuth } from '@/core/auth';
import { buildRoleCacheKey, swrCache, useSWRResource } from '@/core/cache';
import { useLocale } from '@/core/i18n';
import { fetchCustomerDashboard } from './api';
import type { CustomerDashboard } from './types';

export const CUSTOMER_DASHBOARD_CACHE_TTL_MS = 20_000;

export function getCustomerDashboardCacheKey(userId: string): string {
  return buildRoleCacheKey(userId, 'customer', 'dashboard');
}

export function useCustomerDashboard() {
  const { user, activeRole } = useAuth();
  const { locale } = useLocale();
  const isFocused = useIsFocused();
  const appStateRef = useRef<string | null | undefined>(AppState.currentState);

  const cacheKey =
    user && activeRole === 'customer'
      ? getCustomerDashboardCacheKey(user.id)
      : null;

  const { data, isLoading, isRefreshing, error, refresh } =
    useSWRResource<CustomerDashboard>({
      key: cacheKey,
      fetcher: fetchCustomerDashboard,
      ttlMs: CUSTOMER_DASHBOARD_CACHE_TTL_MS,
      enabled: Boolean(cacheKey),
    });

  // Revalidate whenever returning to the Cashback tab so milestone progress and balances stay fresh.
  useFocusEffect(
    useCallback(() => {
      if (!cacheKey) {
        return;
      }
      const snapshot = swrCache.getSnapshot<CustomerDashboard>(cacheKey);
      if ((!snapshot || !snapshot.isFresh) && !swrCache.isRevalidating(cacheKey)) {
        void refresh(false);
      }
    }, [cacheKey, refresh]),
  );

  // Revalidate on AppState resume while the tab is focused (e.g. after an in-store merchant QR scan).
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (
        previousState !== 'active' &&
        nextState === 'active' &&
        isFocused &&
        cacheKey
      ) {
        void refresh(true);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [cacheKey, isFocused, refresh]);

  const errorMessage = useMemo(
    () => (error ? mapApiErrorToMessage(error, locale) : null),
    [error, locale],
  );

  return {
    dashboard: data,
    isLoading,
    isRefreshing,
    errorMessage,
    refresh,
  };
}
