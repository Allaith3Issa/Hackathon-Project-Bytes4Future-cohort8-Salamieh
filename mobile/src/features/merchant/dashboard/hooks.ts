import { useFocusEffect, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';

import { mapApiErrorToMessage } from '@/core/api';
import { useAuth } from '@/core/auth';
import { buildRoleCacheKey, swrCache, useSWRResource } from '@/core/cache';
import { useLocale } from '@/core/i18n';
import { fetchMerchantDashboard } from './api';
import type { MerchantDashboard } from './types';

export const MERCHANT_DASHBOARD_CACHE_TTL_MS = 20_000;

export function getMerchantDashboardCacheKey(userId: string): string {
  return buildRoleCacheKey(userId, 'merchant', 'dashboard');
}

export function useMerchantDashboard() {
  const { user, activeRole, syncAccount } = useAuth();
  const { locale } = useLocale();
  const isFocused = useIsFocused();
  const appStateRef = useRef<string | null | undefined>(AppState.currentState);

  const cacheKey =
    user && activeRole === 'merchant'
      ? getMerchantDashboardCacheKey(user.id)
      : null;

  const { data, isLoading, isRefreshing, error, refresh } =
    useSWRResource<MerchantDashboard>({
      key: cacheKey,
      fetcher: fetchMerchantDashboard,
      ttlMs: MERCHANT_DASHBOARD_CACHE_TTL_MS,
      enabled: Boolean(cacheKey),
    });

  useEffect(() => {
    if (
      data &&
      user?.merchant &&
      data.verificationStatus !== user.merchant.verificationStatus
    ) {
      syncAccount({
        ...user,
        merchant: {
          ...user.merchant,
          verificationStatus: data.verificationStatus,
        },
      });
    }
  }, [data, syncAccount, user]);

  // Revalidate whenever returning to the dashboard so balances and sales figures remain fresh.
  useFocusEffect(
    useCallback(() => {
      if (!cacheKey) {
        return;
      }
      const snapshot = swrCache.getSnapshot<MerchantDashboard>(cacheKey);
      if ((!snapshot || !snapshot.isFresh) && !swrCache.isRevalidating(cacheKey)) {
        void refresh(false);
      }
    }, [cacheKey, refresh]),
  );

  // Revalidate on AppState resume while dashboard tab is focused.
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
