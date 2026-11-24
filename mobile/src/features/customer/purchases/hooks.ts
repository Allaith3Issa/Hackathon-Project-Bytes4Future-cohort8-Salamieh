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
import { buildRoleCacheKey, swrCache } from '@/core/cache';
import { useLocale } from '@/core/i18n';
import {
  DEFAULT_CUSTOMER_PURCHASES_PAGE_SIZE,
  fetchCustomerPurchases,
} from './api';
import type { CustomerPurchase } from './types';

export const CUSTOMER_PURCHASES_CACHE_TTL_MS = 20_000;

const NOOP_SUBSCRIBE = () => () => undefined;
const NULL_SNAPSHOT = () => null;

export function getCustomerPurchasesCacheKey(userId: string): string {
  return buildRoleCacheKey(userId, 'customer', 'purchases');
}

export interface CustomerPurchasesCacheSnapshot {
  items: CustomerPurchase[];
  nextPage: number | null;
  total: number;
}

/**
 * Deduplicates paginated customer purchases by authoritative saleId in O(n) via Map.
 */
export function mergeCustomerPurchasesBySaleId(
  existing: CustomerPurchase[],
  incoming: CustomerPurchase[],
): CustomerPurchase[] {
  const bySaleId = new Map<string, CustomerPurchase>();
  for (const item of existing) {
    bySaleId.set(item.saleId, item);
  }
  for (const item of incoming) {
    bySaleId.set(item.saleId, item);
  }
  return Array.from(bySaleId.values());
}

export function useCustomerPurchases(
  pageSize = DEFAULT_CUSTOMER_PURCHASES_PAGE_SIZE,
) {
  const { user, activeRole } = useAuth();
  const { locale } = useLocale();
  const isFocused = useIsFocused();
  const appStateRef = useRef<string | null | undefined>(AppState.currentState);

  const cacheKey =
    user && activeRole === 'customer'
      ? getCustomerPurchasesCacheKey(user.id)
      : null;

  const subscribe = useCallback(
    (listener: () => void) =>
      cacheKey ? swrCache.subscribe(cacheKey, listener) : NOOP_SUBSCRIBE(),
    [cacheKey],
  );
  const getSnapshot = useCallback(
    () =>
      cacheKey
        ? swrCache.getData<CustomerPurchasesCacheSnapshot>(cacheKey)
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
  const [loadMoreErrorState, setLoadMoreErrorState] = useState<{
    key: string | null;
    error: unknown;
  }>({
    key: null,
    error: null,
  });

  const requestSeqRef = useRef(0);
  const activeCacheKeyRef = useRef<string | null>(cacheKey);
  const inFlightPagesRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    activeCacheKeyRef.current = cacheKey;
    inFlightPagesRef.current.clear();
    setLoadMoreErrorState({ key: cacheKey, error: null });
  }, [cacheKey]);

  const activeError = errorState.key === cacheKey ? errorState.error : null;
  const activeLoadMoreError =
    loadMoreErrorState.key === cacheKey ? loadMoreErrorState.error : null;
  const hasLoaded = cachedData !== null;
  const items = cachedData?.items ?? [];
  const nextPage = cachedData?.nextPage ?? null;
  const total = cachedData?.total ?? 0;
  const isLoading = Boolean(cacheKey && cachedData === null && activeError === null);

  const applyFirstPageSnapshot = useCallback(
    (
      targetKey: string,
      response: {
        items: CustomerPurchase[];
        nextPage: number | null;
        total: number;
      },
      preserveLoadedPages: boolean,
    ) => {
      const existingSnapshot =
        swrCache.getData<CustomerPurchasesCacheSnapshot>(targetKey);
      const hasLoadedBeyondFirstPage =
        existingSnapshot !== null &&
        ((existingSnapshot.nextPage !== null && existingSnapshot.nextPage > 2) ||
          (existingSnapshot.nextPage === null &&
            existingSnapshot.items.length > pageSize));
      const shouldPreserveLoaded = preserveLoadedPages && hasLoadedBeyondFirstPage;

      let nextItems: CustomerPurchase[];
      let resolvedNextPage = response.nextPage;

      if (shouldPreserveLoaded && existingSnapshot) {
        const freshFirstPageIds = new Set(response.items.map((item) => item.saleId));
        const preservedTail = existingSnapshot.items.filter(
          (item) => !freshFirstPageIds.has(item.saleId),
        );
        nextItems = mergeCustomerPurchasesBySaleId(response.items, preservedTail);
        resolvedNextPage = existingSnapshot.nextPage;
      } else {
        nextItems = mergeCustomerPurchasesBySaleId([], response.items);
      }

      swrCache.set<CustomerPurchasesCacheSnapshot>(
        targetKey,
        {
          items: nextItems,
          nextPage: resolvedNextPage,
          total: response.total,
        },
        CUSTOMER_PURCHASES_CACHE_TTL_MS,
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
        const response = await fetchCustomerPurchases({ page: 1, pageSize });

        // Guard against stale responses after account/role switch or newer requests.
        if (
          requestSeqRef.current !== requestId ||
          activeCacheKeyRef.current !== targetKey
        ) {
          return;
        }

        applyFirstPageSnapshot(targetKey, response, preserveLoadedPages);
        setErrorState({ key: targetKey, error: null });
        if (!preserveLoadedPages) {
          setLoadMoreErrorState({ key: targetKey, error: null });
        }
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
          setIsLoadingMore(false);
        }
      }
    },
    [applyFirstPageSnapshot, cacheKey, pageSize],
  );

  const loadMore = useCallback(async () => {
    const targetKey = cacheKey;
    if (!targetKey || isLoading || isRefreshing || inFlightPagesRef.current.size > 0) {
      return;
    }

    const currentSnapshot =
      swrCache.getData<CustomerPurchasesCacheSnapshot>(targetKey);
    if (!currentSnapshot || currentSnapshot.nextPage === null) {
      return;
    }

    const targetPage = currentSnapshot.nextPage;
    if (inFlightPagesRef.current.has(targetPage)) {
      return;
    }

    const requestId = ++requestSeqRef.current;
    inFlightPagesRef.current.add(targetPage);
    setIsLoadingMore(true);
    setLoadMoreErrorState({ key: targetKey, error: null });

    try {
      const response = await fetchCustomerPurchases({
        page: targetPage,
        pageSize,
      });

      if (
        requestSeqRef.current !== requestId ||
        activeCacheKeyRef.current !== targetKey
      ) {
        return;
      }

      const latestSnapshot =
        swrCache.getData<CustomerPurchasesCacheSnapshot>(targetKey);
      const merged = mergeCustomerPurchasesBySaleId(
        latestSnapshot?.items ?? currentSnapshot.items,
        response.items,
      );

      swrCache.set<CustomerPurchasesCacheSnapshot>(
        targetKey,
        {
          items: merged,
          nextPage: response.nextPage,
          total: response.total,
        },
        CUSTOMER_PURCHASES_CACHE_TTL_MS,
      );

      setLoadMoreErrorState({ key: targetKey, error: null });
    } catch (err) {
      if (
        requestSeqRef.current !== requestId ||
        activeCacheKeyRef.current !== targetKey
      ) {
        return;
      }
      setLoadMoreErrorState({ key: targetKey, error: err });
    } finally {
      inFlightPagesRef.current.delete(targetPage);
      if (
        requestSeqRef.current === requestId &&
        activeCacheKeyRef.current === targetKey
      ) {
        setIsLoadingMore(false);
      }
    }
  }, [cacheKey, isLoading, isRefreshing, pageSize]);

  useEffect(() => {
    if (!cacheKey) {
      return;
    }

    const snapshot =
      swrCache.getSnapshot<CustomerPurchasesCacheSnapshot>(cacheKey);
    if (snapshot?.isFresh || inFlightPagesRef.current.has(1)) {
      return;
    }

    let cancelled = false;
    const targetKey = cacheKey;
    const requestId = ++requestSeqRef.current;
    inFlightPagesRef.current.add(1);

    fetchCustomerPurchases({ page: 1, pageSize })
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

  // Refresh whenever returning to the Purchases screen so newly scanned purchases appear promptly without wiping loaded pages.
  useFocusEffect(
    useCallback(() => {
      if (!cacheKey) {
        return;
      }
      const snapshot = swrCache.getSnapshot<CustomerPurchasesCacheSnapshot>(cacheKey);
      if ((!snapshot || !snapshot.isFresh) && !inFlightPagesRef.current.has(1)) {
        void loadFirstPage({ isRefresh: false, preserveLoadedPages: true });
      }
    }, [cacheKey, loadFirstPage]),
  );

  // Refresh silently on AppState resume while the Purchases tab is focused, preserving loaded pages.
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

  const loadMoreErrorMessage = useMemo(
    () =>
      activeLoadMoreError ? mapApiErrorToMessage(activeLoadMoreError, locale) : null,
    [activeLoadMoreError, locale],
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
    loadMoreErrorMessage,
    refresh,
    loadMore,
  };
}
