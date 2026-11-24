import { useFocusEffect, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';

import { mapApiErrorToMessage } from '@/core/api';
import { useAuth } from '@/core/auth';
import { buildUserCacheKey, swrCache, useSWRResource } from '@/core/cache';
import { useLocale } from '@/core/i18n';
import { fetchMarketerWallet } from './api';
import type { MarketerWallet } from './types';

export const WALLET_CACHE_TTL_MS = 20_000;

export function getWalletCacheKey(userId: string): string {
  return buildUserCacheKey(userId, 'wallet:summary');
}

export function useMarketerWallet() {
  const { user } = useAuth();
  const { locale } = useLocale();
  const isFocused = useIsFocused();
  const appStateRef = useRef<string | null | undefined>(AppState.currentState);

  const cacheKey = user ? getWalletCacheKey(user.id) : null;

  const { data, isLoading, isRefreshing, error, refresh } =
    useSWRResource<MarketerWallet>({
      key: cacheKey,
      fetcher: fetchMarketerWallet,
      ttlMs: WALLET_CACHE_TTL_MS,
      enabled: Boolean(cacheKey),
    });

  // Revalidate whenever returning to the Wallet tab so settled commissions appear promptly.
  useFocusEffect(
    useCallback(() => {
      if (!cacheKey) {
        return;
      }
      if (swrCache.getData<MarketerWallet>(cacheKey) !== null) {
        void refresh(true);
      }
    }, [cacheKey, refresh]),
  );

  // Refresh automatically when the app resumes to the foreground (e.g., returning after merchant QR scan).
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
    wallet: data,
    availableBalanceSyp: data?.availableBalanceSyp ?? 0,
    isLoading,
    isRefreshing,
    errorMessage,
    refresh,
  };
}
