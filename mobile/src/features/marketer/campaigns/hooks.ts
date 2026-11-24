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

import { getSessionEpoch, mapApiErrorToMessage } from '@/core/api';
import { useAuth } from '@/core/auth';
import { buildRoleCacheKey, swrCache, useSWRResource } from '@/core/cache';
import { useLocale } from '@/core/i18n';
import {
  DEFAULT_MARKETER_CAMPAIGNS_PAGE_SIZE,
  fetchCampaignDetails,
  fetchCampaignFeed,
  joinCampaignById,
  mergeCampaignFeedPages,
  upsertMembershipInFeed,
} from './api';
import type {
  CampaignFeedPayload,
  CampaignViewModel,
  MarketerMembership,
} from './types';

export const CAMPAIGNS_CACHE_TTL_MS = 60_000;
export const CAMPAIGNS_SEARCH_DEBOUNCE_MS = 350;

const NOOP_SUBSCRIBE = () => () => undefined;
const NULL_SNAPSHOT = () => null;

export function getCampaignsFeedCacheKey(userId: string, query = ''): string {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return buildRoleCacheKey(userId, 'marketer', 'campaigns:feed');
  }
  return buildRoleCacheKey(
    userId,
    'marketer',
    `campaigns:feed:q:${encodeURIComponent(normalizedQuery)}`,
  );
}

export function getCampaignDetailCacheKey(userId: string, campaignId: string): string {
  return buildRoleCacheKey(userId, 'marketer', `campaigns:detail:${campaignId}`);
}

export function useCampaignsFeed(
  pageSize = DEFAULT_MARKETER_CAMPAIGNS_PAGE_SIZE,
) {
  const { user, activeRole } = useAuth();
  const { locale } = useLocale();
  const isFocused = useIsFocused();
  const appStateRef = useRef<string | null | undefined>(AppState.currentState);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const normalized = searchQuery.trim();
    const timer = setTimeout(() => {
      setDebouncedQuery(normalized);
    }, CAMPAIGNS_SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const cacheKey =
    user && activeRole === 'marketer'
      ? getCampaignsFeedCacheKey(user.id, debouncedQuery)
      : null;

  const subscribe = useCallback(
    (listener: () => void) =>
      cacheKey ? swrCache.subscribe(cacheKey, listener) : NOOP_SUBSCRIBE(),
    [cacheKey],
  );
  const getSnapshot = useCallback(
    () =>
      cacheKey ? swrCache.getData<CampaignFeedPayload>(cacheKey) : NULL_SNAPSHOT(),
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
    inFlightPagesRef.current.clear();
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsRefreshing(false);
    setIsLoadingMore(false);
    setLoadMoreErrorState({ key: cacheKey, error: null });
  }, [cacheKey]);

  const activeError = errorState.key === cacheKey ? errorState.error : null;
  const activeLoadMoreError =
    loadMoreErrorState.key === cacheKey ? loadMoreErrorState.error : null;
  const hasLoaded = cachedData !== null;
  const nextPage = cachedData?.nextPage ?? null;
  const isLoading = Boolean(cacheKey && cachedData === null && activeError === null);

  const applyFirstPageSnapshot = useCallback(
    (
      targetKey: string,
      incomingFeed: CampaignFeedPayload,
      preserveLoadedPages: boolean,
    ) => {
      const existingSnapshot = swrCache.getData<CampaignFeedPayload>(targetKey);
      const hasLoadedBeyondFirstPage =
        existingSnapshot !== null &&
        ((existingSnapshot.nextPage !== null && existingSnapshot.nextPage > 2) ||
          (existingSnapshot.nextPage === null &&
            existingSnapshot.orderedIds.length > pageSize));

      const nextPayload =
        preserveLoadedPages && hasLoadedBeyondFirstPage && existingSnapshot
          ? mergeCampaignFeedPages(incomingFeed, existingSnapshot, {
              preserveNextPage: existingSnapshot.nextPage,
            })
          : incomingFeed;

      swrCache.set<CampaignFeedPayload>(
        targetKey,
        nextPayload,
        CAMPAIGNS_CACHE_TTL_MS,
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

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const requestId = ++requestSeqRef.current;
      inFlightPagesRef.current.add(1);

      if (isRefresh) {
        setIsRefreshing(true);
      }

      try {
        const payload = await fetchCampaignFeed({
          page: 1,
          pageSize,
          q: debouncedQuery || undefined,
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

        applyFirstPageSnapshot(targetKey, payload, preserveLoadedPages);
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
          setIsRefreshing(false);
          setIsLoadingMore(false);
        }
      }
    },
    [applyFirstPageSnapshot, cacheKey, debouncedQuery, pageSize],
  );

  const loadMore = useCallback(async () => {
    const targetKey = cacheKey;
    if (!targetKey || isLoading || isRefreshing || inFlightPagesRef.current.size > 0) {
      return;
    }

    const currentSnapshot = swrCache.getData<CampaignFeedPayload>(targetKey);
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
    setIsLoadingMore(true);
    setLoadMoreErrorState({ key: targetKey, error: null });

    try {
      const incomingPage = await fetchCampaignFeed({
        page: targetPage,
        pageSize,
        q: debouncedQuery || undefined,
        signal: controller.signal,
        existingMembershipsByCampaignId: currentSnapshot.membershipsByCampaignId,
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
        swrCache.getData<CampaignFeedPayload>(targetKey) ?? currentSnapshot;
      const merged = mergeCampaignFeedPages(latestSnapshot, incomingPage);

      swrCache.set<CampaignFeedPayload>(
        targetKey,
        merged,
        CAMPAIGNS_CACHE_TTL_MS,
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
        setIsLoadingMore(false);
      }
    }
  }, [cacheKey, debouncedQuery, isLoading, isRefreshing, pageSize]);

  useEffect(() => {
    if (!cacheKey) {
      return;
    }

    const snapshot = swrCache.getSnapshot<CampaignFeedPayload>(cacheKey);
    if (snapshot?.isFresh || inFlightPagesRef.current.has(1)) {
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const targetKey = cacheKey;
    const requestId = ++requestSeqRef.current;
    inFlightPagesRef.current.add(1);

    fetchCampaignFeed({
      page: 1,
      pageSize,
      q: debouncedQuery || undefined,
      signal: controller.signal,
    })
      .then((payload) => {
        if (
          controller.signal.aborted ||
          !isMountedRef.current ||
          requestSeqRef.current !== requestId ||
          activeCacheKeyRef.current !== targetKey
        ) {
          return;
        }

        applyFirstPageSnapshot(targetKey, payload, snapshot !== null);
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
        inFlightPagesRef.current.delete(1);
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      });

    return () => {
      controller.abort();
      inFlightPagesRef.current.delete(1);
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    };
  }, [applyFirstPageSnapshot, cacheKey, debouncedQuery, pageSize]);

  useFocusEffect(
    useCallback(() => {
      if (!cacheKey) {
        return;
      }
      const snapshot = swrCache.getSnapshot<CampaignFeedPayload>(cacheKey);
      if ((!snapshot || !snapshot.isFresh) && !inFlightPagesRef.current.has(1)) {
        void loadFirstPage({ isRefresh: false, preserveLoadedPages: true });
      }
    }, [cacheKey, loadFirstPage]),
  );

  // Revalidate active campaigns silently when returning from background.
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

  const refresh = useCallback(
    async (_force = true) => {
      await loadFirstPage({ isRefresh: true, preserveLoadedPages: false });
    },
    [loadFirstPage],
  );

  const items = useMemo<CampaignViewModel[]>(() => {
    if (!cachedData) {
      return [];
    }

    const result: CampaignViewModel[] = [];
    for (const id of cachedData.orderedIds) {
      const entry = cachedData.byId.get(id);
      if (entry) {
        result.push(entry);
      }
    }
    return result;
  }, [cachedData]);

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
    byId: cachedData?.byId ?? null,
    totalCount: cachedData?.total ?? 0,
    nextPage,
    hasLoaded,
    hasAnyCampaigns: Boolean(cachedData && cachedData.orderedIds.length > 0),
    isLoading,
    isRefreshing,
    isLoadingMore,
    errorMessage,
    loadMoreErrorMessage,
    searchQuery,
    debouncedQuery,
    setSearchQuery,
    refresh,
    loadMore,
  };
}

export function useCampaignDetails(campaignId: string) {
  const { user, activeRole } = useAuth();
  const { locale } = useLocale();
  const isFocused = useIsFocused();
  const appStateRef = useRef<string | null | undefined>(AppState.currentState);

  const isMarketerActive = Boolean(user && activeRole === 'marketer');
  const detailKey =
    isMarketerActive && user && campaignId
      ? getCampaignDetailCacheKey(user.id, campaignId)
      : null;
  const feedKey = isMarketerActive && user ? getCampaignsFeedCacheKey(user.id) : null;
  const userId = user?.id ?? null;

  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const activeDetailKeyRef = useRef<string | null>(detailKey);
  const activeFeedKeyRef = useRef<string | null>(feedKey);
  activeDetailKeyRef.current = detailKey;
  activeFeedKeyRef.current = feedKey;

  // Set<campaignId> deduplication preventing concurrent duplicate POST /join calls.
  const inFlightJoinIdsRef = useRef(new Set<string>());

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    activeDetailKeyRef.current = detailKey;
    activeFeedKeyRef.current = feedKey;
    setJoinError(null);
    setIsJoining(false);
  }, [detailKey, feedKey]);

  const fetcher = useCallback(
    () => fetchCampaignDetails(campaignId),
    [campaignId],
  );

  const { data, isLoading, isRefreshing, error, refresh, applyOptimistic } =
    useSWRResource<CampaignViewModel>({
      key: detailKey,
      fetcher,
      ttlMs: CAMPAIGNS_CACHE_TTL_MS,
      enabled: Boolean(detailKey && campaignId),
    });

  useFocusEffect(
    useCallback(() => {
      if (!detailKey) {
        return;
      }
      const snapshot = swrCache.getSnapshot<CampaignViewModel>(detailKey);
      if ((!snapshot || !snapshot.isFresh) && !swrCache.isRevalidating(detailKey)) {
        void refresh(false);
      }
    }, [detailKey, refresh]),
  );

  // Revalidate campaign details and membership status when app resumes to foreground.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (
        previousState !== 'active' &&
        nextState === 'active' &&
        isFocused &&
        detailKey
      ) {
        void refresh(false);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [detailKey, isFocused, refresh]);

  const errorMessage = useMemo(
    () => (error ? mapApiErrorToMessage(error, locale) : null),
    [error, locale],
  );

  const joinCampaign = useCallback(async (): Promise<MarketerMembership | null> => {
    if (
      !campaignId ||
      !data ||
      !isMarketerActive ||
      inFlightJoinIdsRef.current.has(campaignId)
    ) {
      return null;
    }

    const expectedDetailKey = detailKey;
    const expectedFeedKey = feedKey;
    const expectedUserId = userId;
    const startSessionEpoch = getSessionEpoch();

    const isContextStillActive = (): boolean =>
      getSessionEpoch() === startSessionEpoch &&
      activeDetailKeyRef.current === expectedDetailKey &&
      activeFeedKeyRef.current === expectedFeedKey;

    inFlightJoinIdsRef.current.add(campaignId);
    setIsJoining(true);
    setJoinError(null);

    const optimisticMembership: MarketerMembership = {
      id: `optimistic:${campaignId}`,
      status: data.campaign.joinMode === 'open' ? 'approved' : 'pending',
      requestedAt: new Date().toISOString(),
      campaign: data.campaign,
      // Never fabricate referralUrl optimistically; wait for authoritative API response.
      referralUrl: null,
      stats: {
        clicks: 0,
        itemsSold: 0,
        earnedSyp: 0,
        conversionRatePercent: 0,
      },
    };

    // Snapshot pre-mutation state for reversible rollback if POST /join fails.
    const rollbackDetail = applyOptimistic((current) => ({
      ...current,
      membership: current.membership ?? optimisticMembership,
    }));

    const previousFeedSnapshot = expectedFeedKey
      ? swrCache.getSnapshot<CampaignFeedPayload>(expectedFeedKey)
      : null;

    if (expectedFeedKey && previousFeedSnapshot) {
      swrCache.set(
        expectedFeedKey,
        upsertMembershipInFeed(previousFeedSnapshot.data, optimisticMembership),
        CAMPAIGNS_CACHE_TTL_MS,
      );
    }

    try {
      const serverMembership = await joinCampaignById(campaignId);

      if (!isContextStillActive()) {
        return null;
      }

      if (expectedDetailKey) {
        swrCache.set<CampaignViewModel>(
          expectedDetailKey,
          {
            campaign: serverMembership.campaign ?? data.campaign,
            membership: serverMembership,
          },
          CAMPAIGNS_CACHE_TTL_MS,
        );
      }

      if (expectedFeedKey) {
        const latestFeed =
          swrCache.getSnapshot<CampaignFeedPayload>(expectedFeedKey);
        if (latestFeed) {
          swrCache.set(
            expectedFeedKey,
            upsertMembershipInFeed(latestFeed.data, serverMembership),
            CAMPAIGNS_CACHE_TTL_MS,
          );
        }
      }

      if (expectedUserId) {
        swrCache.markStalePrefix(`${expectedUserId}:marketer:campaigns:feed:q:`);
      }

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
      return serverMembership;
    } catch (err: unknown) {
      if (!isContextStillActive()) {
        return null;
      }

      // Roll back both detail and feed caches to pre-mutation snapshots.
      rollbackDetail();
      if (expectedFeedKey && previousFeedSnapshot) {
        swrCache.set(
          expectedFeedKey,
          previousFeedSnapshot.data,
          CAMPAIGNS_CACHE_TTL_MS,
        );
      }

      if (isMountedRef.current) {
        setJoinError(mapApiErrorToMessage(err, locale));
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => undefined,
      );
      return null;
    } finally {
      inFlightJoinIdsRef.current.delete(campaignId);
      if (isMountedRef.current && isContextStillActive()) {
        setIsJoining(false);
      }
    }
  }, [
    applyOptimistic,
    campaignId,
    data,
    detailKey,
    feedKey,
    isMarketerActive,
    locale,
    userId,
  ]);

  return {
    viewModel: data,
    isLoading,
    isRefreshing,
    isJoining,
    errorMessage,
    joinError,
    refresh,
    joinCampaign,
  };
}
