import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';

import { mapApiErrorToMessage } from '@/core/api';
import { useAuth } from '@/core/auth';
import { buildUserCacheKey, swrCache, useSWRResource } from '@/core/cache';
import { useLocale } from '@/core/i18n';
import {
  fetchCampaignDetails,
  fetchCampaignFeed,
  joinCampaignById,
  upsertMembershipInFeed,
} from './api';
import type { CampaignFeedPayload, CampaignViewModel, MarketerMembership } from './types';

export const CAMPAIGNS_CACHE_TTL_MS = 60_000;

export function getCampaignsFeedCacheKey(userId: string): string {
  return buildUserCacheKey(userId, 'campaigns:feed');
}

export function getCampaignDetailCacheKey(userId: string, campaignId: string): string {
  return buildUserCacheKey(userId, `campaigns:detail:${campaignId}`);
}

export function useCampaignsFeed() {
  const { user } = useAuth();
  const { locale } = useLocale();
  const [searchQuery, setSearchQuery] = useState('');

  const cacheKey = user ? getCampaignsFeedCacheKey(user.id) : null;

  const { data, isLoading, isRefreshing, error, refresh, applyOptimistic } =
    useSWRResource<CampaignFeedPayload>({
      key: cacheKey,
      fetcher: fetchCampaignFeed,
      ttlMs: CAMPAIGNS_CACHE_TTL_MS,
      enabled: Boolean(cacheKey),
    });

  useFocusEffect(
    useCallback(() => {
      if (!cacheKey) {
        return;
      }
      const snapshot = swrCache.getSnapshot<CampaignFeedPayload>(cacheKey);
      if (snapshot && !snapshot.isFresh) {
        void refresh(false);
      }
    }, [cacheKey, refresh]),
  );

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const items = useMemo<CampaignViewModel[]>(() => {
    if (!data) {
      return [];
    }

    const result: CampaignViewModel[] = [];
    for (const id of data.orderedIds) {
      const entry = data.byId.get(id);
      if (!entry) {
        continue;
      }

      if (normalizedSearch.length > 0) {
        const haystack =
          `${entry.campaign.productName} ${entry.campaign.shopName} ${entry.campaign.description}`.toLowerCase();
        if (!haystack.includes(normalizedSearch)) {
          continue;
        }
      }

      result.push(entry);
    }

    return result;
  }, [data, normalizedSearch]);

  const errorMessage = useMemo(
    () => (error ? mapApiErrorToMessage(error, locale) : null),
    [error, locale],
  );

  return {
    items,
    byId: data?.byId ?? null,
    totalCount: data?.total ?? 0,
    hasAnyCampaigns: Boolean(data && data.orderedIds.length > 0),
    isLoading,
    isRefreshing,
    errorMessage,
    searchQuery,
    setSearchQuery,
    refresh,
    applyOptimistic,
  };
}

export function useCampaignDetails(campaignId: string) {
  const { user } = useAuth();
  const { locale } = useLocale();

  const detailKey =
    user && campaignId ? getCampaignDetailCacheKey(user.id, campaignId) : null;
  const feedKey = user ? getCampaignsFeedCacheKey(user.id) : null;

  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Set<campaignId> deduplication preventing concurrent duplicate POST /join calls.
  const inFlightJoinIdsRef = useRef(new Set<string>());

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
      if (snapshot && !snapshot.isFresh) {
        void refresh(false);
      }
    }, [detailKey, refresh]),
  );

  const errorMessage = useMemo(
    () => (error ? mapApiErrorToMessage(error, locale) : null),
    [error, locale],
  );

  const joinCampaign = useCallback(async (): Promise<MarketerMembership | null> => {
    if (!campaignId || !data || inFlightJoinIdsRef.current.has(campaignId)) {
      return null;
    }

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

    const previousFeedSnapshot = feedKey
      ? swrCache.getSnapshot<CampaignFeedPayload>(feedKey)
      : null;

    if (feedKey && previousFeedSnapshot) {
      swrCache.set(
        feedKey,
        upsertMembershipInFeed(previousFeedSnapshot.data, optimisticMembership),
        CAMPAIGNS_CACHE_TTL_MS,
      );
    }

    try {
      const serverMembership = await joinCampaignById(campaignId);

      if (detailKey) {
        swrCache.set<CampaignViewModel>(
          detailKey,
          {
            campaign: serverMembership.campaign ?? data.campaign,
            membership: serverMembership,
          },
          CAMPAIGNS_CACHE_TTL_MS,
        );
      }

      if (feedKey) {
        const latestFeed = swrCache.getSnapshot<CampaignFeedPayload>(feedKey);
        if (latestFeed) {
          swrCache.set(
            feedKey,
            upsertMembershipInFeed(latestFeed.data, serverMembership),
            CAMPAIGNS_CACHE_TTL_MS,
          );
        }
      }

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
      return serverMembership;
    } catch (err: unknown) {
      // Roll back both detail and feed caches to pre-mutation snapshots.
      rollbackDetail();
      if (feedKey && previousFeedSnapshot) {
        swrCache.set(
          feedKey,
          previousFeedSnapshot.data,
          CAMPAIGNS_CACHE_TTL_MS,
        );
      }

      setJoinError(mapApiErrorToMessage(err, locale));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => undefined,
      );
      return null;
    } finally {
      inFlightJoinIdsRef.current.delete(campaignId);
      setIsJoining(false);
    }
  }, [applyOptimistic, campaignId, data, detailKey, feedKey, locale]);

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
