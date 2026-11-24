import * as Haptics from 'expo-haptics';
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

import {
  ApiClientError,
  createIdempotencyKey,
  getSessionEpoch,
  isApiClientError,
  mapApiErrorToMessage,
} from '@/core/api';
import { useAuth } from '@/core/auth';
import { buildRoleCacheKey, swrCache, useSWRResource } from '@/core/cache';
import { useLocale } from '@/core/i18n';
import {
  DEFAULT_MARKETER_WALLET_PAGE_SIZE,
  fetchMarketerEarningsByMerchant,
  fetchMarketerPayouts,
  fetchMarketerStats,
  fetchMarketerWallet,
  fetchMarketerWalletTransactions,
  requestMarketerPayout,
} from './api';
import type {
  MarketerMerchantEarnings,
  MarketerPayout,
  MarketerStats,
  MarketerWallet,
  MarketerWalletTransaction,
  PayoutStatus,
} from './types';

export const WALLET_CACHE_TTL_MS = 20_000;

const NOOP_SUBSCRIBE = () => () => undefined;
const NULL_SNAPSHOT = () => null;

export function getWalletCacheKey(userId: string): string {
  return buildRoleCacheKey(userId, 'marketer', 'wallet:summary');
}

export function getMarketerStatsCacheKey(userId: string): string {
  return buildRoleCacheKey(userId, 'marketer', 'wallet:stats');
}

export function getMarketerByMerchantCacheKey(userId: string): string {
  return buildRoleCacheKey(userId, 'marketer', 'wallet:by-merchant');
}

export function getMarketerTransactionsCacheKey(userId: string): string {
  return buildRoleCacheKey(userId, 'marketer', 'wallet:transactions');
}

export function getMarketerPayoutsCachePrefix(userId: string): string {
  return buildRoleCacheKey(userId, 'marketer', 'wallet:payouts');
}

export function getMarketerPayoutsCacheKey(
  userId: string,
  status: PayoutStatus | 'all' = 'all',
): string {
  return buildRoleCacheKey(userId, 'marketer', `wallet:payouts:${status}`);
}

/**
 * Non-destructive SWR revalidation trigger after creating a payout or detecting
 * wallet changes. Marks wallet summary, ledger transactions, and all filtered
 * payout lists stale without wiping existing snapshots to Skeletons.
 */
export function syncMarketerPayoutCaches(userId: string): void {
  swrCache.markStale(getWalletCacheKey(userId));
  swrCache.markStale(getMarketerTransactionsCacheKey(userId));
  swrCache.markStalePrefix(getMarketerPayoutsCachePrefix(userId));
}

export interface MarketerMerchantEarningsCacheSnapshot {
  items: MarketerMerchantEarnings[];
  nextPage: number | null;
  total: number;
}

export interface MarketerTransactionsCacheSnapshot {
  items: MarketerWalletTransaction[];
  nextPage: number | null;
  total: number;
}

export interface MarketerPayoutsCacheSnapshot {
  items: MarketerPayout[];
  nextPage: number | null;
  total: number;
}

function mergeByMerchantId(
  existing: MarketerMerchantEarnings[],
  incoming: MarketerMerchantEarnings[],
): MarketerMerchantEarnings[] {
  const byId = new Map<string, MarketerMerchantEarnings>();
  for (const item of existing) {
    byId.set(item.merchantId, item);
  }
  for (const item of incoming) {
    byId.set(item.merchantId, item);
  }
  return Array.from(byId.values());
}

function mergeTransactionsById(
  existing: MarketerWalletTransaction[],
  incoming: MarketerWalletTransaction[],
): MarketerWalletTransaction[] {
  const byId = new Map<string, MarketerWalletTransaction>();
  for (const item of existing) {
    byId.set(item.id, item);
  }
  for (const item of incoming) {
    byId.set(item.id, item);
  }
  return Array.from(byId.values());
}

function mergePayoutsById(
  existing: MarketerPayout[],
  incoming: MarketerPayout[],
): MarketerPayout[] {
  const byId = new Map<string, MarketerPayout>();
  for (const item of existing) {
    byId.set(item.id, item);
  }
  for (const item of incoming) {
    byId.set(item.id, item);
  }
  return Array.from(byId.values());
}

export function useMarketerWallet() {
  const { user, activeRole } = useAuth();
  const { locale } = useLocale();
  const isFocused = useIsFocused();
  const appStateRef = useRef<string | null | undefined>(AppState.currentState);

  const cacheKey =
    user && activeRole === 'marketer' ? getWalletCacheKey(user.id) : null;

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
      const snapshot = swrCache.getSnapshot<MarketerWallet>(cacheKey);
      if ((!snapshot || !snapshot.isFresh) && !swrCache.isRevalidating(cacheKey)) {
        void refresh(false);
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
    pendingPayoutSyp: data?.pendingPayoutSyp ?? 0,
    totalEarnedSyp: data?.totalEarnedSyp ?? 0,
    totalConfirmedPaidOutSyp: data?.totalConfirmedPaidOutSyp ?? 0,
    isLoading,
    isRefreshing,
    errorMessage,
    refresh,
  };
}

export interface MarketerWalletSectionOptions {
  enabled?: boolean;
}

export function useMarketerStats(options: MarketerWalletSectionOptions = {}) {
  const enabled = options.enabled ?? true;
  const { user, activeRole } = useAuth();
  const { locale } = useLocale();
  const isFocused = useIsFocused();
  const appStateRef = useRef<string | null | undefined>(AppState.currentState);

  const cacheKey =
    user && activeRole === 'marketer' ? getMarketerStatsCacheKey(user.id) : null;

  const { data, isLoading, isRefreshing, error, refresh } =
    useSWRResource<MarketerStats>({
      key: cacheKey,
      fetcher: fetchMarketerStats,
      ttlMs: WALLET_CACHE_TTL_MS,
      enabled: Boolean(cacheKey && enabled),
    });

  useFocusEffect(
    useCallback(() => {
      if (!cacheKey || !enabled) {
        return;
      }
      const snapshot = swrCache.getSnapshot<MarketerStats>(cacheKey);
      if ((!snapshot || !snapshot.isFresh) && !swrCache.isRevalidating(cacheKey)) {
        void refresh(false);
      }
    }, [cacheKey, enabled, refresh]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (
        previousState !== 'active' &&
        nextState === 'active' &&
        isFocused &&
        enabled &&
        cacheKey
      ) {
        void refresh(true);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [cacheKey, enabled, isFocused, refresh]);

  const errorMessage = useMemo(
    () => (error ? mapApiErrorToMessage(error, locale) : null),
    [error, locale],
  );

  return {
    stats: data,
    clicks: data?.clicks ?? 0,
    itemsSold: data?.itemsSold ?? 0,
    earnedSyp: data?.earnedSyp ?? 0,
    conversionRatePercent: data?.conversionRatePercent ?? 0,
    isLoading,
    isRefreshing,
    errorMessage,
    refresh,
  };
}

export function useMarketerEarningsByMerchant(
  pageSize = DEFAULT_MARKETER_WALLET_PAGE_SIZE,
  options: MarketerWalletSectionOptions = {},
) {
  const enabled = options.enabled ?? true;
  const { user, activeRole } = useAuth();
  const { locale } = useLocale();
  const isFocused = useIsFocused();
  const appStateRef = useRef<string | null | undefined>(AppState.currentState);

  const cacheKey =
    user && activeRole === 'marketer'
      ? getMarketerByMerchantCacheKey(user.id)
      : null;

  const subscribe = useCallback(
    (listener: () => void) =>
      cacheKey ? swrCache.subscribe(cacheKey, listener) : NOOP_SUBSCRIBE(),
    [cacheKey],
  );
  const getSnapshot = useCallback(
    () =>
      cacheKey
        ? swrCache.getData<MarketerMerchantEarningsCacheSnapshot>(cacheKey)
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
    setIsRefreshing(false);
    setIsLoadingMore(false);
    setLoadMoreErrorState({ key: cacheKey, error: null });
  }, [cacheKey]);

  const activeError = errorState.key === cacheKey ? errorState.error : null;
  const activeLoadMoreError =
    loadMoreErrorState.key === cacheKey ? loadMoreErrorState.error : null;
  const hasLoaded = cachedData !== null;
  const items = cachedData?.items ?? [];
  const nextPage = cachedData?.nextPage ?? null;
  const total = cachedData?.total ?? 0;
  const isLoading = Boolean(
    cacheKey && enabled && cachedData === null && activeError === null,
  );

  const applyFirstPageSnapshot = useCallback(
    (
      targetKey: string,
      response: {
        items: MarketerMerchantEarnings[];
        nextPage: number | null;
        total: number;
      },
      preserveLoadedPages: boolean,
    ) => {
      const existingSnapshot =
        swrCache.getData<MarketerMerchantEarningsCacheSnapshot>(targetKey);
      const hasLoadedBeyondFirstPage =
        existingSnapshot !== null &&
        ((existingSnapshot.nextPage !== null && existingSnapshot.nextPage > 2) ||
          (existingSnapshot.nextPage === null &&
            existingSnapshot.items.length > pageSize));
      const shouldPreserveLoaded = preserveLoadedPages && hasLoadedBeyondFirstPage;

      let nextItems: MarketerMerchantEarnings[];
      let resolvedNextPage = response.nextPage;

      if (shouldPreserveLoaded && existingSnapshot) {
        const freshFirstPageIds = new Set(response.items.map((item) => item.merchantId));
        const preservedTail = existingSnapshot.items.filter(
          (item) => !freshFirstPageIds.has(item.merchantId),
        );
        nextItems = mergeByMerchantId(response.items, preservedTail);
        resolvedNextPage = existingSnapshot.nextPage;
      } else {
        nextItems = mergeByMerchantId([], response.items);
      }

      swrCache.set<MarketerMerchantEarningsCacheSnapshot>(
        targetKey,
        {
          items: nextItems,
          nextPage: resolvedNextPage,
          total: response.total,
        },
        WALLET_CACHE_TTL_MS,
      );
    },
    [pageSize],
  );

  const loadFirstPage = useCallback(
    async (
      loadOptions: { isRefresh?: boolean; preserveLoadedPages?: boolean } = {},
    ) => {
      const targetKey = cacheKey;
      if (!targetKey || !enabled || inFlightPagesRef.current.has(1)) {
        return;
      }

      const isRefresh = loadOptions.isRefresh ?? false;
      const preserveLoadedPages = loadOptions.preserveLoadedPages ?? false;
      const requestId = ++requestSeqRef.current;
      inFlightPagesRef.current.add(1);

      if (isRefresh) {
        setIsRefreshing(true);
      }

      try {
        const response = await fetchMarketerEarningsByMerchant(1, pageSize);

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
    [applyFirstPageSnapshot, cacheKey, enabled, pageSize],
  );

  const loadMore = useCallback(async () => {
    const targetKey = cacheKey;
    if (
      !targetKey ||
      !enabled ||
      isLoading ||
      isRefreshing ||
      inFlightPagesRef.current.size > 0
    ) {
      return;
    }

    const currentSnapshot =
      swrCache.getData<MarketerMerchantEarningsCacheSnapshot>(targetKey);
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
      const response = await fetchMarketerEarningsByMerchant(targetPage, pageSize);

      if (
        requestSeqRef.current !== requestId ||
        activeCacheKeyRef.current !== targetKey
      ) {
        return;
      }

      const latestSnapshot =
        swrCache.getData<MarketerMerchantEarningsCacheSnapshot>(targetKey);
      const merged = mergeByMerchantId(
        latestSnapshot?.items ?? currentSnapshot.items,
        response.items,
      );

      swrCache.set<MarketerMerchantEarningsCacheSnapshot>(
        targetKey,
        {
          items: merged,
          nextPage: response.nextPage,
          total: response.total,
        },
        WALLET_CACHE_TTL_MS,
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
  }, [cacheKey, enabled, isLoading, isRefreshing, pageSize]);

  useEffect(() => {
    if (!cacheKey || !enabled) {
      return;
    }

    const snapshot =
      swrCache.getSnapshot<MarketerMerchantEarningsCacheSnapshot>(cacheKey);
    if (snapshot?.isFresh || inFlightPagesRef.current.has(1)) {
      return;
    }

    let cancelled = false;
    const targetKey = cacheKey;
    const requestId = ++requestSeqRef.current;
    inFlightPagesRef.current.add(1);

    fetchMarketerEarningsByMerchant(1, pageSize)
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
  }, [applyFirstPageSnapshot, cacheKey, enabled, pageSize]);

  useFocusEffect(
    useCallback(() => {
      if (!cacheKey || !enabled) {
        return;
      }
      const snapshot =
        swrCache.getSnapshot<MarketerMerchantEarningsCacheSnapshot>(cacheKey);
      if ((!snapshot || !snapshot.isFresh) && !inFlightPagesRef.current.has(1)) {
        void loadFirstPage({ isRefresh: false, preserveLoadedPages: true });
      }
    }, [cacheKey, enabled, loadFirstPage]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (
        previousState !== 'active' &&
        nextState === 'active' &&
        isFocused &&
        enabled &&
        cacheKey
      ) {
        void loadFirstPage({ isRefresh: false, preserveLoadedPages: true });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [cacheKey, enabled, isFocused, loadFirstPage]);

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

export function useMarketerTransactions(
  pageSize = DEFAULT_MARKETER_WALLET_PAGE_SIZE,
  options: MarketerWalletSectionOptions = {},
) {
  const enabled = options.enabled ?? true;
  const { user, activeRole } = useAuth();
  const { locale } = useLocale();
  const isFocused = useIsFocused();
  const appStateRef = useRef<string | null | undefined>(AppState.currentState);

  const cacheKey =
    user && activeRole === 'marketer'
      ? getMarketerTransactionsCacheKey(user.id)
      : null;

  const subscribe = useCallback(
    (listener: () => void) =>
      cacheKey ? swrCache.subscribe(cacheKey, listener) : NOOP_SUBSCRIBE(),
    [cacheKey],
  );
  const getSnapshot = useCallback(
    () =>
      cacheKey
        ? swrCache.getData<MarketerTransactionsCacheSnapshot>(cacheKey)
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
    setIsRefreshing(false);
    setIsLoadingMore(false);
    setLoadMoreErrorState({ key: cacheKey, error: null });
  }, [cacheKey]);

  const activeError = errorState.key === cacheKey ? errorState.error : null;
  const activeLoadMoreError =
    loadMoreErrorState.key === cacheKey ? loadMoreErrorState.error : null;
  const hasLoaded = cachedData !== null;
  const items = cachedData?.items ?? [];
  const nextPage = cachedData?.nextPage ?? null;
  const total = cachedData?.total ?? 0;
  const isLoading = Boolean(
    cacheKey && enabled && cachedData === null && activeError === null,
  );

  const applyFirstPageSnapshot = useCallback(
    (
      targetKey: string,
      response: {
        items: MarketerWalletTransaction[];
        nextPage: number | null;
        total: number;
      },
      preserveLoadedPages: boolean,
    ) => {
      const existingSnapshot =
        swrCache.getData<MarketerTransactionsCacheSnapshot>(targetKey);
      const hasLoadedBeyondFirstPage =
        existingSnapshot !== null &&
        ((existingSnapshot.nextPage !== null && existingSnapshot.nextPage > 2) ||
          (existingSnapshot.nextPage === null &&
            existingSnapshot.items.length > pageSize));
      const shouldPreserveLoaded = preserveLoadedPages && hasLoadedBeyondFirstPage;

      let nextItems: MarketerWalletTransaction[];
      let resolvedNextPage = response.nextPage;

      if (shouldPreserveLoaded && existingSnapshot) {
        const freshFirstPageIds = new Set(response.items.map((item) => item.id));
        const preservedTail = existingSnapshot.items.filter(
          (item) => !freshFirstPageIds.has(item.id),
        );
        nextItems = mergeTransactionsById(response.items, preservedTail);
        resolvedNextPage = existingSnapshot.nextPage;
      } else {
        nextItems = mergeTransactionsById([], response.items);
      }

      swrCache.set<MarketerTransactionsCacheSnapshot>(
        targetKey,
        {
          items: nextItems,
          nextPage: resolvedNextPage,
          total: response.total,
        },
        WALLET_CACHE_TTL_MS,
      );
    },
    [pageSize],
  );

  const loadFirstPage = useCallback(
    async (
      loadOptions: { isRefresh?: boolean; preserveLoadedPages?: boolean } = {},
    ) => {
      const targetKey = cacheKey;
      if (!targetKey || !enabled || inFlightPagesRef.current.has(1)) {
        return;
      }

      const isRefresh = loadOptions.isRefresh ?? false;
      const preserveLoadedPages = loadOptions.preserveLoadedPages ?? false;
      const requestId = ++requestSeqRef.current;
      inFlightPagesRef.current.add(1);

      if (isRefresh) {
        setIsRefreshing(true);
      }

      try {
        const response = await fetchMarketerWalletTransactions(1, pageSize);

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
    [applyFirstPageSnapshot, cacheKey, enabled, pageSize],
  );

  const loadMore = useCallback(async () => {
    const targetKey = cacheKey;
    if (
      !targetKey ||
      !enabled ||
      isLoading ||
      isRefreshing ||
      inFlightPagesRef.current.size > 0
    ) {
      return;
    }

    const currentSnapshot =
      swrCache.getData<MarketerTransactionsCacheSnapshot>(targetKey);
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
      const response = await fetchMarketerWalletTransactions(targetPage, pageSize);

      if (
        requestSeqRef.current !== requestId ||
        activeCacheKeyRef.current !== targetKey
      ) {
        return;
      }

      const latestSnapshot =
        swrCache.getData<MarketerTransactionsCacheSnapshot>(targetKey);
      const merged = mergeTransactionsById(
        latestSnapshot?.items ?? currentSnapshot.items,
        response.items,
      );

      swrCache.set<MarketerTransactionsCacheSnapshot>(
        targetKey,
        {
          items: merged,
          nextPage: response.nextPage,
          total: response.total,
        },
        WALLET_CACHE_TTL_MS,
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
  }, [cacheKey, enabled, isLoading, isRefreshing, pageSize]);

  useEffect(() => {
    if (!cacheKey || !enabled) {
      return;
    }

    const snapshot =
      swrCache.getSnapshot<MarketerTransactionsCacheSnapshot>(cacheKey);
    if (snapshot?.isFresh || inFlightPagesRef.current.has(1)) {
      return;
    }

    let cancelled = false;
    const targetKey = cacheKey;
    const requestId = ++requestSeqRef.current;
    inFlightPagesRef.current.add(1);

    fetchMarketerWalletTransactions(1, pageSize)
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
  }, [applyFirstPageSnapshot, cacheKey, enabled, pageSize]);

  useFocusEffect(
    useCallback(() => {
      if (!cacheKey || !enabled) {
        return;
      }
      const snapshot =
        swrCache.getSnapshot<MarketerTransactionsCacheSnapshot>(cacheKey);
      if ((!snapshot || !snapshot.isFresh) && !inFlightPagesRef.current.has(1)) {
        void loadFirstPage({ isRefresh: false, preserveLoadedPages: true });
      }
    }, [cacheKey, enabled, loadFirstPage]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (
        previousState !== 'active' &&
        nextState === 'active' &&
        isFocused &&
        enabled &&
        cacheKey
      ) {
        void loadFirstPage({ isRefresh: false, preserveLoadedPages: true });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [cacheKey, enabled, isFocused, loadFirstPage]);

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

export interface MarketerPayoutsSectionOptions {
  enabled?: boolean;
  status?: PayoutStatus | 'all';
}

function mergeFirstPageIntoPayoutSnapshot(
  existingSnapshot: MarketerPayoutsCacheSnapshot | null,
  response: {
    items: MarketerPayout[];
    nextPage: number | null;
    total: number;
  },
  pageSize: number,
  preserveLoadedPages: boolean,
): MarketerPayoutsCacheSnapshot {
  const hasLoadedBeyondFirstPage =
    existingSnapshot !== null &&
    ((existingSnapshot.nextPage !== null && existingSnapshot.nextPage > 2) ||
      (existingSnapshot.nextPage === null &&
        existingSnapshot.items.length > pageSize));
  const shouldPreserveLoaded = preserveLoadedPages && hasLoadedBeyondFirstPage;

  let nextItems: MarketerPayout[];
  let resolvedNextPage = response.nextPage;

  if (shouldPreserveLoaded && existingSnapshot) {
    const freshFirstPageIds = new Set(response.items.map((item) => item.id));
    const preservedTail = existingSnapshot.items.filter(
      (item) => !freshFirstPageIds.has(item.id),
    );
    nextItems = mergePayoutsById(response.items, preservedTail);
    resolvedNextPage = existingSnapshot.nextPage;
  } else {
    nextItems = mergePayoutsById([], response.items);
  }

  return {
    items: nextItems,
    nextPage: resolvedNextPage,
    total: response.total,
  };
}

function prependPayoutToCachedList(
  targetKey: string,
  payout: MarketerPayout,
): void {
  const existingSnapshot =
    swrCache.getData<MarketerPayoutsCacheSnapshot>(targetKey);
  if (!existingSnapshot) {
    return;
  }

  const alreadyExists = existingSnapshot.items.some((item) => item.id === payout.id);
  const nextItems = mergePayoutsById([payout], existingSnapshot.items);
  swrCache.set<MarketerPayoutsCacheSnapshot>(
    targetKey,
    {
      items: nextItems,
      nextPage: existingSnapshot.nextPage,
      total: alreadyExists ? existingSnapshot.total : existingSnapshot.total + 1,
    },
    WALLET_CACHE_TTL_MS,
  );
}

export function useMarketerPayouts(
  pageSize = DEFAULT_MARKETER_WALLET_PAGE_SIZE,
  options: MarketerPayoutsSectionOptions = {},
) {
  const enabled = options.enabled ?? true;
  const status = options.status ?? 'all';
  const { user, activeRole } = useAuth();
  const { locale } = useLocale();
  const isFocused = useIsFocused();
  const appStateRef = useRef<string | null | undefined>(AppState.currentState);

  const cacheKey =
    user && activeRole === 'marketer'
      ? getMarketerPayoutsCacheKey(user.id, status)
      : null;

  const subscribe = useCallback(
    (listener: () => void) =>
      cacheKey ? swrCache.subscribe(cacheKey, listener) : NOOP_SUBSCRIBE(),
    [cacheKey],
  );
  const getSnapshot = useCallback(
    () =>
      cacheKey
        ? swrCache.getData<MarketerPayoutsCacheSnapshot>(cacheKey)
        : NULL_SNAPSHOT(),
    [cacheKey],
  );

  const cachedData = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // Key-scoped transient flags avoid synchronous setState inside useEffect when status/account changes.
  const [refreshingState, setRefreshingState] = useState<{
    key: string | null;
    value: boolean;
  }>({
    key: null,
    value: false,
  });
  const [loadingMoreState, setLoadingMoreState] = useState<{
    key: string | null;
    value: boolean;
  }>({
    key: null,
    value: false,
  });
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

  const isMountedRef = useRef(true);
  const requestSeqRef = useRef(0);
  const activeCacheKeyRef = useRef<string | null>(cacheKey);
  const inFlightPagesRef = useRef<Set<number>>(new Set());
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    activeCacheKeyRef.current = cacheKey;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    inFlightPagesRef.current.clear();
  }, [cacheKey, enabled]);

  const isRefreshing = Boolean(
    cacheKey && enabled && refreshingState.key === cacheKey && refreshingState.value,
  );
  const isLoadingMore = Boolean(
    cacheKey && enabled && loadingMoreState.key === cacheKey && loadingMoreState.value,
  );
  const activeError = errorState.key === cacheKey ? errorState.error : null;
  const activeLoadMoreError =
    loadMoreErrorState.key === cacheKey ? loadMoreErrorState.error : null;
  const hasLoaded = cachedData !== null;
  const items = cachedData?.items ?? [];
  const nextPage = cachedData?.nextPage ?? null;
  const total = cachedData?.total ?? 0;
  const isLoading = Boolean(
    cacheKey && enabled && cachedData === null && activeError === null,
  );

  const statusParam = status === 'all' ? undefined : status;

  const applyFirstPageSnapshot = useCallback(
    (
      targetKey: string,
      response: {
        items: MarketerPayout[];
        nextPage: number | null;
        total: number;
      },
      preserveLoadedPages: boolean,
    ) => {
      const existingSnapshot =
        swrCache.getData<MarketerPayoutsCacheSnapshot>(targetKey);
      const nextSnapshot = mergeFirstPageIntoPayoutSnapshot(
        existingSnapshot,
        response,
        pageSize,
        preserveLoadedPages,
      );
      swrCache.set<MarketerPayoutsCacheSnapshot>(
        targetKey,
        nextSnapshot,
        WALLET_CACHE_TTL_MS,
      );
    },
    [pageSize],
  );

  const loadFirstPage = useCallback(
    async (
      loadOptions: { isRefresh?: boolean; preserveLoadedPages?: boolean } = {},
    ) => {
      const targetKey = cacheKey;
      if (!targetKey || !enabled || inFlightPagesRef.current.has(1)) {
        return;
      }

      const isRefresh = loadOptions.isRefresh ?? false;
      const preserveLoadedPages = loadOptions.preserveLoadedPages ?? false;

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const requestId = ++requestSeqRef.current;
      inFlightPagesRef.current.add(1);

      if (isRefresh) {
        setRefreshingState({ key: targetKey, value: true });
      }

      try {
        const response = await fetchMarketerPayouts({
          page: 1,
          pageSize,
          status: statusParam,
          signal: controller.signal,
        });

        if (
          controller.signal.aborted ||
          !isMountedRef.current ||
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
          controller.signal.aborted ||
          !isMountedRef.current ||
          requestSeqRef.current !== requestId ||
          activeCacheKeyRef.current !== targetKey
        ) {
          return;
        }
        setErrorState({ key: targetKey, error: err });
      } finally {
        inFlightPagesRef.current.delete(1);
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
        if (
          isMountedRef.current &&
          requestSeqRef.current === requestId &&
          activeCacheKeyRef.current === targetKey
        ) {
          setRefreshingState({ key: targetKey, value: false });
          setLoadingMoreState({ key: targetKey, value: false });
        }
      }
    },
    [applyFirstPageSnapshot, cacheKey, enabled, pageSize, statusParam],
  );

  const loadMore = useCallback(async () => {
    const targetKey = cacheKey;
    if (
      !targetKey ||
      !enabled ||
      isLoading ||
      isRefreshing ||
      inFlightPagesRef.current.size > 0
    ) {
      return;
    }

    const currentSnapshot =
      swrCache.getData<MarketerPayoutsCacheSnapshot>(targetKey);
    if (!currentSnapshot || currentSnapshot.nextPage === null) {
      return;
    }

    const targetPage = currentSnapshot.nextPage;
    if (inFlightPagesRef.current.has(targetPage)) {
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const requestId = ++requestSeqRef.current;
    inFlightPagesRef.current.add(targetPage);
    setLoadingMoreState({ key: targetKey, value: true });
    setLoadMoreErrorState({ key: targetKey, error: null });

    try {
      const response = await fetchMarketerPayouts({
        page: targetPage,
        pageSize,
        status: statusParam,
        signal: controller.signal,
      });

      if (
        controller.signal.aborted ||
        !isMountedRef.current ||
        requestSeqRef.current !== requestId ||
        activeCacheKeyRef.current !== targetKey
      ) {
        return;
      }

      const latestSnapshot =
        swrCache.getData<MarketerPayoutsCacheSnapshot>(targetKey);
      const merged = mergePayoutsById(
        latestSnapshot?.items ?? currentSnapshot.items,
        response.items,
      );

      swrCache.set<MarketerPayoutsCacheSnapshot>(
        targetKey,
        {
          items: merged,
          nextPage: response.nextPage,
          total: response.total,
        },
        WALLET_CACHE_TTL_MS,
      );

      setLoadMoreErrorState({ key: targetKey, error: null });
    } catch (err) {
      if (
        controller.signal.aborted ||
        !isMountedRef.current ||
        requestSeqRef.current !== requestId ||
        activeCacheKeyRef.current !== targetKey
      ) {
        return;
      }
      setLoadMoreErrorState({ key: targetKey, error: err });
    } finally {
      inFlightPagesRef.current.delete(targetPage);
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      if (
        isMountedRef.current &&
        requestSeqRef.current === requestId &&
        activeCacheKeyRef.current === targetKey
      ) {
        setLoadingMoreState({ key: targetKey, value: false });
      }
    }
  }, [cacheKey, enabled, isLoading, isRefreshing, pageSize, statusParam]);

  useEffect(() => {
    if (!cacheKey || !enabled) {
      return;
    }

    const inFlightPages = inFlightPagesRef.current;
    const snapshot =
      swrCache.getSnapshot<MarketerPayoutsCacheSnapshot>(cacheKey);
    if (snapshot?.isFresh || inFlightPages.has(1)) {
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const targetKey = cacheKey;
    const requestId = ++requestSeqRef.current;
    inFlightPages.add(1);

    fetchMarketerPayouts({
      page: 1,
      pageSize,
      status: statusParam,
      signal: controller.signal,
    })
      .then((response) => {
        if (
          controller.signal.aborted ||
          !isMountedRef.current ||
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
          controller.signal.aborted ||
          !isMountedRef.current ||
          requestSeqRef.current !== requestId ||
          activeCacheKeyRef.current !== targetKey
        ) {
          return;
        }
        setErrorState({ key: targetKey, error: err });
      })
      .finally(() => {
        inFlightPages.delete(1);
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      });

    return () => {
      controller.abort();
      inFlightPages.delete(1);
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    };
  }, [applyFirstPageSnapshot, cacheKey, enabled, pageSize, statusParam]);

  useFocusEffect(
    useCallback(() => {
      if (!cacheKey || !enabled) {
        return;
      }
      const snapshot =
        swrCache.getSnapshot<MarketerPayoutsCacheSnapshot>(cacheKey);
      if ((!snapshot || !snapshot.isFresh) && !inFlightPagesRef.current.has(1)) {
        void loadFirstPage({ isRefresh: false, preserveLoadedPages: true });
      }
    }, [cacheKey, enabled, loadFirstPage]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (
        previousState !== 'active' &&
        nextState === 'active' &&
        isFocused &&
        enabled &&
        cacheKey
      ) {
        void loadFirstPage({ isRefresh: false, preserveLoadedPages: true });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [cacheKey, enabled, isFocused, loadFirstPage]);

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

export type RequestMarketerPayoutResult =
  | { ok: true; payout: MarketerPayout }
  | {
      ok: false;
      reason: 'amount_changed' | 'already_pending' | 'error';
      errorMessage: string;
    };

const PAYOUT_KEY_RESET_ERROR_CODES = new Set<string>([
  'PAYOUT_AMOUNT_CHANGED',
  'PAYOUT_ALREADY_PENDING',
  'INSUFFICIENT_WALLET_BALANCE',
  'IDEMPOTENCY_KEY_REUSED',
  'VALIDATION_ERROR',
]);

export function useRequestMarketerPayout() {
  const { user, activeRole } = useAuth();
  const { locale } = useLocale();

  const contextKey =
    user && activeRole === 'marketer' ? `${user.id}:${activeRole}` : null;

  const [submittingState, setSubmittingState] = useState<{
    key: string | null;
    value: boolean;
  }>({
    key: null,
    value: false,
  });
  const [errorState, setErrorState] = useState<{
    key: string | null;
    message: string | null;
  }>({
    key: null,
    message: null,
  });
  const [lastCreatedState, setLastCreatedState] = useState<{
    key: string | null;
    payout: MarketerPayout | null;
  }>({
    key: null,
    payout: null,
  });

  const isMountedRef = useRef(true);
  const isSubmittingRef = useRef(false);
  const activeContextKeyRef = useRef<string | null>(contextKey);
  const idempotencySlotRef = useRef<{
    userId: string;
    expectedAmountSyp: number;
    sessionEpoch: number;
    key: string;
  } | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    activeContextKeyRef.current = contextKey;
    idempotencySlotRef.current = null;
  }, [contextKey]);

  const isSubmitting = Boolean(
    contextKey && submittingState.key === contextKey && submittingState.value,
  );
  const errorMessage =
    contextKey && errorState.key === contextKey ? errorState.message : null;
  const lastCreatedPayout =
    contextKey && lastCreatedState.key === contextKey
      ? lastCreatedState.payout
      : null;

  const revalidateWalletSilently = useCallback(
    (targetUserId: string, startSessionEpoch: number) => {
      const walletKey = getWalletCacheKey(targetUserId);
      void swrCache
        .revalidate(
          walletKey,
          async () => {
            const wallet = await fetchMarketerWallet();
            if (getSessionEpoch() !== startSessionEpoch) {
              throw new Error('Stale session epoch');
            }
            return wallet;
          },
          { ttlMs: WALLET_CACHE_TTL_MS, force: true },
        )
        .catch(() => undefined);
    },
    [],
  );

  const revalidatePayoutsAndTransactionsSilently = useCallback(
    (targetUserId: string, startSessionEpoch: number) => {
      const payoutKeysToSync: { key: string; status?: PayoutStatus }[] = [
        { key: getMarketerPayoutsCacheKey(targetUserId, 'all') },
        {
          key: getMarketerPayoutsCacheKey(targetUserId, 'pending_review'),
          status: 'pending_review',
        },
      ];

      for (const entry of payoutKeysToSync) {
        if (!swrCache.getData<MarketerPayoutsCacheSnapshot>(entry.key)) {
          continue;
        }
        const versionAtStart = swrCache.getKeyVersion(entry.key);
        void fetchMarketerPayouts({
          page: 1,
          pageSize: DEFAULT_MARKETER_WALLET_PAGE_SIZE,
          status: entry.status,
        })
          .then((response) => {
            if (getSessionEpoch() !== startSessionEpoch) {
              return;
            }
            const currentVersion = swrCache.getKeyVersion(entry.key);
            if (
              currentVersion.cacheEpoch !== versionAtStart.cacheEpoch ||
              currentVersion.keyVersion !== versionAtStart.keyVersion
            ) {
              return;
            }
            const existing =
              swrCache.getData<MarketerPayoutsCacheSnapshot>(entry.key);
            const merged = mergeFirstPageIntoPayoutSnapshot(
              existing,
              response,
              DEFAULT_MARKETER_WALLET_PAGE_SIZE,
              existing !== null,
            );
            swrCache.set(entry.key, merged, WALLET_CACHE_TTL_MS);
          })
          .catch(() => undefined);
      }

      const txKey = getMarketerTransactionsCacheKey(targetUserId);
      if (swrCache.getData<MarketerTransactionsCacheSnapshot>(txKey)) {
        const txVersionAtStart = swrCache.getKeyVersion(txKey);
        void fetchMarketerWalletTransactions(1, DEFAULT_MARKETER_WALLET_PAGE_SIZE)
          .then((response) => {
            if (getSessionEpoch() !== startSessionEpoch) {
              return;
            }
            const currentVersion = swrCache.getKeyVersion(txKey);
            if (
              currentVersion.cacheEpoch !== txVersionAtStart.cacheEpoch ||
              currentVersion.keyVersion !== txVersionAtStart.keyVersion
            ) {
              return;
            }
            const existing =
              swrCache.getData<MarketerTransactionsCacheSnapshot>(txKey);
            const hasLoadedBeyondFirstPage =
              existing !== null &&
              ((existing.nextPage !== null && existing.nextPage > 2) ||
                (existing.nextPage === null &&
                  existing.items.length > DEFAULT_MARKETER_WALLET_PAGE_SIZE));
            let nextItems: MarketerWalletTransaction[];
            let resolvedNextPage = response.nextPage;
            if (hasLoadedBeyondFirstPage && existing) {
              const freshIds = new Set(response.items.map((item) => item.id));
              const tail = existing.items.filter((item) => !freshIds.has(item.id));
              nextItems = mergeTransactionsById(response.items, tail);
              resolvedNextPage = existing.nextPage;
            } else {
              nextItems = mergeTransactionsById([], response.items);
            }
            swrCache.set<MarketerTransactionsCacheSnapshot>(
              txKey,
              {
                items: nextItems,
                nextPage: resolvedNextPage,
                total: response.total,
              },
              WALLET_CACHE_TTL_MS,
            );
          })
          .catch(() => undefined);
      }
    },
    [],
  );

  const resetPayoutState = useCallback(() => {
    idempotencySlotRef.current = null;
    if (isMountedRef.current) {
      setErrorState({ key: contextKey, message: null });
      setLastCreatedState({ key: contextKey, payout: null });
    }
  }, [contextKey]);

  const submitPayout = useCallback(
    async (expectedAmountSyp: number): Promise<RequestMarketerPayoutResult | null> => {
      if (
        !user ||
        activeRole !== 'marketer' ||
        !contextKey ||
        isSubmittingRef.current
      ) {
        return null;
      }

      if (!Number.isSafeInteger(expectedAmountSyp) || expectedAmountSyp < 1) {
        idempotencySlotRef.current = null;
        const validationMessage = mapApiErrorToMessage(
          new ApiClientError(400, 'VALIDATION_ERROR', 'Invalid payout amount.'),
          locale,
        );
        if (isMountedRef.current && activeContextKeyRef.current === contextKey) {
          setErrorState({ key: contextKey, message: validationMessage });
        }
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
          () => undefined,
        );
        return {
          ok: false,
          reason: 'error',
          errorMessage: validationMessage,
        };
      }

      const targetUserId = user.id;
      const expectedContextKey = contextKey;
      const startSessionEpoch = getSessionEpoch();
      const existingSlot = idempotencySlotRef.current;

      const idempotencyKey =
        existingSlot &&
        existingSlot.userId === targetUserId &&
        existingSlot.expectedAmountSyp === expectedAmountSyp &&
        existingSlot.sessionEpoch === startSessionEpoch
          ? existingSlot.key
          : createIdempotencyKey();

      idempotencySlotRef.current = {
        userId: targetUserId,
        expectedAmountSyp,
        sessionEpoch: startSessionEpoch,
        key: idempotencyKey,
      };

      isSubmittingRef.current = true;
      setSubmittingState({ key: expectedContextKey, value: true });
      setErrorState({ key: expectedContextKey, message: null });

      try {
        const createdPayout = await requestMarketerPayout(
          expectedAmountSyp,
          idempotencyKey,
        );

        if (getSessionEpoch() !== startSessionEpoch) {
          return null;
        }

        // Clear Idempotency-Key immediately upon authoritative 201 completion.
        idempotencySlotRef.current = null;

        // Prepend real server-returned PayoutDto into cached lists before marking stale
        // so the UI reflects the new pending_review payout without Skeleton flicker.
        prependPayoutToCachedList(
          getMarketerPayoutsCacheKey(targetUserId, 'all'),
          createdPayout,
        );
        prependPayoutToCachedList(
          getMarketerPayoutsCacheKey(targetUserId, 'pending_review'),
          createdPayout,
        );
        syncMarketerPayoutCaches(targetUserId);
        revalidateWalletSilently(targetUserId, startSessionEpoch);
        revalidatePayoutsAndTransactionsSilently(targetUserId, startSessionEpoch);

        if (isMountedRef.current && activeContextKeyRef.current === expectedContextKey) {
          setErrorState({ key: expectedContextKey, message: null });
          setLastCreatedState({ key: expectedContextKey, payout: createdPayout });
        }

        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => undefined);

        return { ok: true, payout: createdPayout };
      } catch (err: unknown) {
        if (getSessionEpoch() !== startSessionEpoch) {
          return null;
        }

        const errorCode = isApiClientError(err) ? err.code : null;
        if (errorCode && PAYOUT_KEY_RESET_ERROR_CODES.has(errorCode)) {
          idempotencySlotRef.current = null;
        }

        if (
          errorCode === 'PAYOUT_AMOUNT_CHANGED' ||
          errorCode === 'PAYOUT_ALREADY_PENDING'
        ) {
          syncMarketerPayoutCaches(targetUserId);
          revalidateWalletSilently(targetUserId, startSessionEpoch);
          if (errorCode === 'PAYOUT_ALREADY_PENDING') {
            revalidatePayoutsAndTransactionsSilently(targetUserId, startSessionEpoch);
          }
        }

        const mappedMessage = mapApiErrorToMessage(err, locale);
        if (isMountedRef.current && activeContextKeyRef.current === expectedContextKey) {
          setErrorState({ key: expectedContextKey, message: mappedMessage });
        }

        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
          () => undefined,
        );

        const reason: 'amount_changed' | 'already_pending' | 'error' =
          errorCode === 'PAYOUT_AMOUNT_CHANGED'
            ? 'amount_changed'
            : errorCode === 'PAYOUT_ALREADY_PENDING'
              ? 'already_pending'
              : 'error';

        return {
          ok: false,
          reason,
          errorMessage: mappedMessage,
        };
      } finally {
        isSubmittingRef.current = false;
        if (
          isMountedRef.current &&
          activeContextKeyRef.current === expectedContextKey
        ) {
          setSubmittingState({ key: expectedContextKey, value: false });
        }
      }
    },
    [
      activeRole,
      contextKey,
      locale,
      revalidatePayoutsAndTransactionsSilently,
      revalidateWalletSilently,
      user,
    ],
  );

  return {
    isSubmitting,
    errorMessage,
    lastCreatedPayout,
    submitPayout,
    resetPayoutState,
  };
}
