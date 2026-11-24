import { useFocusEffect, useIsFocused } from 'expo-router';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { AppState } from 'react-native';

import { mapApiErrorToMessage } from '@/core/api';
import { useAuth } from '@/core/auth';
import { buildRoleCacheKey, swrCache, useSWRResource } from '@/core/cache';
import { useLocale } from '@/core/i18n';
import {
  DEFAULT_MERCHANT_WALLET_PAGE_SIZE,
  fetchMerchantWallet,
  fetchMerchantWalletTransactions,
} from './api';
import type { MerchantWallet, MerchantWalletTransaction } from './types';

export const MERCHANT_WALLET_CACHE_TTL_MS = 20_000;

const NOOP_SUBSCRIBE = () => () => undefined;
const NULL_SNAPSHOT = () => null;

export function getMerchantWalletCacheKey(userId: string): string {
  return buildRoleCacheKey(userId, 'merchant', 'wallet:summary');
}

export function getMerchantTransactionsCacheKey(userId: string): string {
  return buildRoleCacheKey(userId, 'merchant', 'wallet:transactions');
}

export interface MerchantTransactionsCacheSnapshot {
  items: MerchantWalletTransaction[];
  nextPage: number | null;
  total: number;
}

function mergeTransactionsById(
  existing: MerchantWalletTransaction[],
  incoming: MerchantWalletTransaction[],
): MerchantWalletTransaction[] {
  const byId = new Map<string, MerchantWalletTransaction>();
  for (const item of existing) {
    byId.set(item.id, item);
  }
  for (const item of incoming) {
    byId.set(item.id, item);
  }
  return Array.from(byId.values());
}

export function useMerchantWallet() {
  const { user, activeRole } = useAuth();
  const { locale } = useLocale();
  const isFocused = useIsFocused();
  const appStateRef = useRef<string | null | undefined>(AppState.currentState);

  const cacheKey =
    user && activeRole === 'merchant' ? getMerchantWalletCacheKey(user.id) : null;

  const { data, isLoading, isRefreshing, error, refresh } =
    useSWRResource<MerchantWallet>({
      key: cacheKey,
      fetcher: fetchMerchantWallet,
      ttlMs: MERCHANT_WALLET_CACHE_TTL_MS,
      enabled: Boolean(cacheKey),
    });

  useFocusEffect(
    useCallback(() => {
      if (!cacheKey) {
        return;
      }
      const snapshot = swrCache.getSnapshot<MerchantWallet>(cacheKey);
      if ((!snapshot || !snapshot.isFresh) && !swrCache.isRevalidating(cacheKey)) {
        void refresh(false);
      }
    }, [cacheKey, refresh]),
  );

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
    totalLockedReservesSyp: data?.totalLockedReservesSyp ?? 0,
    creditLimitSyp: data?.creditLimitSyp ?? 0,
    isLoading,
    isRefreshing,
    errorMessage,
    refresh,
  };
}

export function useMerchantTransactions(pageSize = DEFAULT_MERCHANT_WALLET_PAGE_SIZE) {
  const { user, activeRole } = useAuth();
  const { locale } = useLocale();
  const isFocused = useIsFocused();
  const appStateRef = useRef<string | null | undefined>(AppState.currentState);

  const cacheKey =
    user && activeRole === 'merchant'
      ? getMerchantTransactionsCacheKey(user.id)
      : null;

  const subscribe = useCallback(
    (listener: () => void) =>
      cacheKey ? swrCache.subscribe(cacheKey, listener) : NOOP_SUBSCRIBE(),
    [cacheKey],
  );
  const getSnapshot = useCallback(
    () =>
      cacheKey
        ? swrCache.getData<MerchantTransactionsCacheSnapshot>(cacheKey)
        : NULL_SNAPSHOT(),
    [cacheKey],
  );

  const cachedData = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorState, setErrorState] = useState<{ key: string | null; error: unknown }>({
    key: null,
    error: null,
  });

  const requestSeqRef = useRef(0);
  const activeCacheKeyRef = useRef<string | null>(cacheKey);
  const isLoadingMoreRef = useRef(false);
  const inFlightPagesRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    activeCacheKeyRef.current = cacheKey;
    inFlightPagesRef.current.clear();
    isLoadingMoreRef.current = false;
    setIsRefreshing(false);
    setIsLoadingMore(false);
  }, [cacheKey]);

  const activeError = errorState.key === cacheKey ? errorState.error : null;
  const hasLoaded = cachedData !== null;
  const items = cachedData?.items ?? [];
  const nextPage = cachedData?.nextPage ?? null;
  const total = cachedData?.total ?? 0;
  const isLoading = Boolean(cacheKey && cachedData === null && activeError === null);

  const applyFirstPageSnapshot = useCallback(
    (
      targetKey: string,
      response: {
        items: MerchantWalletTransaction[];
        nextPage: number | null;
        total: number;
      },
      preserveLoadedPages: boolean,
    ) => {
      const existingSnapshot =
        swrCache.getData<MerchantTransactionsCacheSnapshot>(targetKey);
      const hasLoadedBeyondFirstPage =
        existingSnapshot !== null &&
        ((existingSnapshot.nextPage !== null && existingSnapshot.nextPage > 2) ||
          (existingSnapshot.nextPage === null &&
            existingSnapshot.items.length > pageSize));
      const shouldPreserveLoaded = preserveLoadedPages && hasLoadedBeyondFirstPage;

      let nextItems: MerchantWalletTransaction[];
      let resolvedNextPage = response.nextPage;

      if (shouldPreserveLoaded && existingSnapshot) {
        const freshIds = new Set(response.items.map((item) => item.id));
        const preservedTail = existingSnapshot.items.filter(
          (item) => !freshIds.has(item.id),
        );
        nextItems = mergeTransactionsById(response.items, preservedTail);
        resolvedNextPage = existingSnapshot.nextPage;
      } else {
        nextItems = mergeTransactionsById([], response.items);
      }

      swrCache.set<MerchantTransactionsCacheSnapshot>(
        targetKey,
        {
          items: nextItems,
          nextPage: resolvedNextPage,
          total: response.total,
        },
        MERCHANT_WALLET_CACHE_TTL_MS,
      );
    },
    [pageSize],
  );

  const loadFirstPage = useCallback(
    async (
      options: { isRefresh?: boolean; preserveLoadedPages?: boolean } = {},
    ) => {
      const targetKey = cacheKey;
      if (!targetKey || inFlightPagesRef.current.has(1)) {
        return;
      }

      const isRefresh = options.isRefresh ?? false;
      const preserveLoadedPages = options.preserveLoadedPages ?? false;
      const requestId = ++requestSeqRef.current;
      inFlightPagesRef.current.add(1);

      if (isRefresh) {
        setIsRefreshing(true);
      }

      try {
        const response = await fetchMerchantWalletTransactions(1, pageSize);

        // Guard against stale responses after account/role switch or newer requests.
        if (
          requestSeqRef.current !== requestId ||
          activeCacheKeyRef.current !== targetKey
        ) {
          return;
        }

        applyFirstPageSnapshot(targetKey, response, preserveLoadedPages);
        setErrorState({ key: targetKey, error: null });
      } catch (err) {
        if (
          requestSeqRef.current !== requestId ||
          activeCacheKeyRef.current !== targetKey
        ) {
          return;
        }
        setErrorState({ key: targetKey, error: err });
      } finally {
        inFlightPagesRef.current.delete(1);
        if (
          requestSeqRef.current === requestId &&
          activeCacheKeyRef.current === targetKey
        ) {
          setIsRefreshing(false);
          isLoadingMoreRef.current = false;
          setIsLoadingMore(false);
        }
      }
    },
    [applyFirstPageSnapshot, cacheKey, pageSize],
  );

  const loadMore = useCallback(async () => {
    const targetKey = cacheKey;
    if (
      !targetKey ||
      isLoadingMoreRef.current ||
      isLoading ||
      isRefreshing ||
      inFlightPagesRef.current.size > 0
    ) {
      return;
    }

    const currentSnapshot = swrCache.getData<MerchantTransactionsCacheSnapshot>(targetKey);
    if (!currentSnapshot || currentSnapshot.nextPage === null) {
      return;
    }

    const targetPage = currentSnapshot.nextPage;
    if (inFlightPagesRef.current.has(targetPage)) {
      return;
    }

    const requestId = ++requestSeqRef.current;
    inFlightPagesRef.current.add(targetPage);
    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);

    try {
      const response = await fetchMerchantWalletTransactions(
        targetPage,
        pageSize,
      );

      if (
        requestSeqRef.current !== requestId ||
        activeCacheKeyRef.current !== targetKey
      ) {
        return;
      }

      const latestSnapshot =
        swrCache.getData<MerchantTransactionsCacheSnapshot>(targetKey);
      const merged = mergeTransactionsById(
        latestSnapshot?.items ?? currentSnapshot.items,
        response.items,
      );

      swrCache.set<MerchantTransactionsCacheSnapshot>(
        targetKey,
        {
          items: merged,
          nextPage: response.nextPage,
          total: response.total,
        },
        MERCHANT_WALLET_CACHE_TTL_MS,
      );

      setErrorState({ key: targetKey, error: null });
    } catch (err) {
      if (
        requestSeqRef.current !== requestId ||
        activeCacheKeyRef.current !== targetKey
      ) {
        return;
      }
      setErrorState({ key: targetKey, error: err });
    } finally {
      inFlightPagesRef.current.delete(targetPage);
      if (
        requestSeqRef.current === requestId &&
        activeCacheKeyRef.current === targetKey
      ) {
        isLoadingMoreRef.current = false;
        setIsLoadingMore(false);
      }
    }
  }, [cacheKey, isLoading, isRefreshing, pageSize]);

  useEffect(() => {
    if (!cacheKey) {
      return;
    }

    const snapshot = swrCache.getSnapshot<MerchantTransactionsCacheSnapshot>(cacheKey);
    if (snapshot?.isFresh || inFlightPagesRef.current.has(1)) {
      return;
    }

    let cancelled = false;
    const targetKey = cacheKey;
    const requestId = ++requestSeqRef.current;
    inFlightPagesRef.current.add(1);

    fetchMerchantWalletTransactions(1, pageSize)
      .then((response) => {
        if (
          cancelled ||
          requestSeqRef.current !== requestId ||
          activeCacheKeyRef.current !== targetKey
        ) {
          return;
        }

        applyFirstPageSnapshot(targetKey, response, snapshot !== null);
        setErrorState({ key: targetKey, error: null });
      })
      .catch((err) => {
        if (
          cancelled ||
          requestSeqRef.current !== requestId ||
          activeCacheKeyRef.current !== targetKey
        ) {
          return;
        }
        setErrorState({ key: targetKey, error: err });
      })
      .finally(() => {
        inFlightPagesRef.current.delete(1);
      });

    return () => {
      cancelled = true;
      inFlightPagesRef.current.delete(1);
    };
  }, [applyFirstPageSnapshot, cacheKey, pageSize]);

  useFocusEffect(
    useCallback(() => {
      if (!cacheKey) {
        return;
      }
      const snapshot = swrCache.getSnapshot<MerchantTransactionsCacheSnapshot>(cacheKey);
      if ((!snapshot || !snapshot.isFresh) && !inFlightPagesRef.current.has(1)) {
        void loadFirstPage({ isRefresh: false, preserveLoadedPages: true });
      }
    }, [cacheKey, loadFirstPage]),
  );

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
        void loadFirstPage({ isRefresh: false, preserveLoadedPages: true });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [cacheKey, isFocused, loadFirstPage]);

  const refresh = useCallback(async () => {
    await loadFirstPage({ isRefresh: true, preserveLoadedPages: false });
  }, [loadFirstPage]);

  const errorMessage = useMemo(
    () => (activeError ? mapApiErrorToMessage(activeError, locale) : null),
    [activeError, locale],
  );

  return {
    items,
    nextPage,
    total,
    hasLoaded,
    isLoading,
    isRefreshing,
    isLoadingMore,
    errorMessage,
    refresh,
    loadMore,
  };
}
