import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';

import { mapApiErrorToMessage } from '@/core/api';
import { useAuth } from '@/core/auth';
import type { MobileWorkspaceRole } from '@/core/auth';
import { buildRoleCacheKey, swrCache, useSWRResource } from '@/core/cache';
import { useLocale } from '@/core/i18n';
import type { AppLocale } from '@/core/i18n';
import { fetchCurrentAccount } from '@/features/auth';
import type { Account } from '@/features/auth';

export const PROFILE_CACHE_TTL_MS = 60_000;

export function getProfileCacheKey(
  userId: string,
  role: MobileWorkspaceRole,
): string {
  return buildRoleCacheKey(userId, role, 'profile:me');
}

export function useProfileAccount() {
  const { user, activeRole, syncAccount } = useAuth();
  const { locale } = useLocale();

  const cacheKey = user && activeRole ? getProfileCacheKey(user.id, activeRole) : null;

  const fetchAndSyncAccount = useCallback(async (): Promise<Account> => {
    const fresh = await fetchCurrentAccount();
    syncAccount(fresh);
    return fresh;
  }, [syncAccount]);

  const { data, isLoading, isRefreshing, error, refresh } =
    useSWRResource<Account>({
      key: cacheKey,
      fetcher: fetchAndSyncAccount,
      ttlMs: PROFILE_CACHE_TTL_MS,
      enabled: Boolean(cacheKey),
    });

  useFocusEffect(
    useCallback(() => {
      if (!cacheKey) {
        return;
      }
      const snapshot = swrCache.getSnapshot<Account>(cacheKey);
      if ((!snapshot || !snapshot.isFresh) && !swrCache.isRevalidating(cacheKey)) {
        void refresh(false);
      }
    }, [cacheKey, refresh]),
  );

  const errorMessage = useMemo(
    () => (error ? mapApiErrorToMessage(error, locale) : null),
    [error, locale],
  );

  return {
    account: data ?? user,
    isLoading: isLoading && !user,
    isRefreshing,
    errorMessage,
    refresh,
  };
}

export function useLanguageSwitcher() {
  const { locale, isRtl, setLocale } = useLocale();

  const switchLanguage = useCallback(
    async (nextLocale: AppLocale) => {
      if (nextLocale === locale) {
        return;
      }
      void Haptics.selectionAsync().catch(() => undefined);
      await setLocale(nextLocale);
    },
    [locale, setLocale],
  );

  return {
    locale,
    isRtl,
    switchLanguage,
  };
}
