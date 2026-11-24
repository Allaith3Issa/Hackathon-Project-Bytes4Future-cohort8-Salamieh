import * as Haptics from 'expo-haptics';
import { useFocusEffect, useIsFocused, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
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
  createIdempotencyKey,
  extractFieldErrors,
  isApiClientError,
  mapApiErrorToMessage,
} from '@/core/api';
import { useAuth } from '@/core/auth';
import { buildRoleCacheKey, swrCache, useSWRResource } from '@/core/cache';
import { useLocale } from '@/core/i18n';
import { getMerchantDashboardCacheKey } from '../dashboard';
import {
  closeMerchantCampaign,
  DEFAULT_MERCHANT_CAMPAIGNS_PAGE_SIZE,
  fetchMerchantCampaignById,
  fetchMerchantCampaigns,
  launchMerchantCampaign,
  previewMerchantCampaign,
} from './api';
import type {
  CampaignPreview,
  MerchantCampaign,
  MerchantCampaignStatusFilter,
} from './types';
import {
  buildEndOfDayIso,
  buildFutureIsoFromDays,
  parsePreviewInputFromDraft,
  validateCampaignDraft,
} from './validation';
import type { CampaignDraftFieldErrors, CampaignDraftFormInput } from './validation';

export const MERCHANT_CAMPAIGNS_CACHE_TTL_MS = 20_000;

const NOOP_SUBSCRIBE = () => () => undefined;
const NULL_SNAPSHOT = () => null;

// In-flight deduplication prevents concurrent duplicate close mutations for the same campaign.
const inFlightCloseCampaigns = new Set<string>();

export function getMerchantCampaignsCacheKey(
  userId: string,
  statusFilter: MerchantCampaignStatusFilter,
): string {
  return buildRoleCacheKey(userId, 'merchant', `campaigns:list:${statusFilter}`);
}

export function getMerchantCampaignDetailCacheKey(
  userId: string,
  campaignId: string,
): string {
  return buildRoleCacheKey(userId, 'merchant', `campaigns:detail:${campaignId}`);
}

/**
 * Invalidate merchant campaign lists, dashboard, and wallet summary/ledger caches
 * after launching or closing a campaign or releasing locked reserves.
 */
export function invalidateMerchantCampaignRelatedCaches(userId: string): void {
  swrCache.markStalePrefix(`${userId}:merchant:campaigns:list:`);
  swrCache.markStale(getMerchantDashboardCacheKey(userId));
  swrCache.markStalePrefix(`${userId}:merchant:wallet:`);
}

export interface MerchantCampaignsCacheSnapshot {
  items: MerchantCampaign[];
  nextPage: number | null;
  total: number;
}

function mergeCampaignsById(
  existing: MerchantCampaign[],
  incoming: MerchantCampaign[],
): MerchantCampaign[] {
  const byId = new Map<string, MerchantCampaign>();
  for (const item of existing) {
    byId.set(item.id, item);
  }
  for (const item of incoming) {
    byId.set(item.id, item);
  }
  return Array.from(byId.values());
}

export function useMerchantCampaigns(
  initialStatus: MerchantCampaignStatusFilter = 'all',
  pageSize = DEFAULT_MERCHANT_CAMPAIGNS_PAGE_SIZE,
) {
  const { user, activeRole } = useAuth();
  const { locale } = useLocale();
  const isFocused = useIsFocused();
  const appStateRef = useRef<string | null | undefined>(AppState.currentState);

  const [statusFilter, setStatusFilter] =
    useState<MerchantCampaignStatusFilter>(initialStatus);

  const cacheKey =
    user && activeRole === 'merchant'
      ? getMerchantCampaignsCacheKey(user.id, statusFilter)
      : null;

  const subscribe = useCallback(
    (listener: () => void) =>
      cacheKey ? swrCache.subscribe(cacheKey, listener) : NOOP_SUBSCRIBE(),
    [cacheKey],
  );
  const getSnapshot = useCallback(
    () =>
      cacheKey
        ? swrCache.getData<MerchantCampaignsCacheSnapshot>(cacheKey)
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

  const isMountedRef = useRef(true);
  const requestSeqRef = useRef(0);
  const activeCacheKeyRef = useRef<string | null>(cacheKey);
  const isLoadingMoreRef = useRef(false);
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

  const statusParam = statusFilter === 'all' ? undefined : statusFilter;

  const applyFirstPageSnapshot = useCallback(
    (
      targetKey: string,
      response: {
        items: MerchantCampaign[];
        nextPage: number | null;
        total: number;
      },
      preserveLoadedPages: boolean,
    ) => {
      const existingSnapshot =
        swrCache.getData<MerchantCampaignsCacheSnapshot>(targetKey);
      const hasLoadedBeyondFirstPage =
        existingSnapshot !== null &&
        ((existingSnapshot.nextPage !== null && existingSnapshot.nextPage > 2) ||
          (existingSnapshot.nextPage === null &&
            existingSnapshot.items.length > pageSize));
      const shouldPreserveLoaded = preserveLoadedPages && hasLoadedBeyondFirstPage;

      let nextItems: MerchantCampaign[];
      let resolvedNextPage = response.nextPage;

      if (shouldPreserveLoaded && existingSnapshot) {
        const freshIds = new Set(response.items.map((item) => item.id));
        const preservedTail = existingSnapshot.items.filter(
          (item) => !freshIds.has(item.id),
        );
        nextItems = mergeCampaignsById(response.items, preservedTail);
        resolvedNextPage = existingSnapshot.nextPage;
      } else {
        nextItems = mergeCampaignsById([], response.items);
      }

      swrCache.set<MerchantCampaignsCacheSnapshot>(
        targetKey,
        {
          items: nextItems,
          nextPage: resolvedNextPage,
          total: response.total,
        },
        MERCHANT_CAMPAIGNS_CACHE_TTL_MS,
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
        const response = await fetchMerchantCampaigns({
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
          isLoadingMoreRef.current = false;
          setIsLoadingMore(false);
        }
      }
    },
    [applyFirstPageSnapshot, cacheKey, pageSize, statusParam],
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

    const currentSnapshot =
      swrCache.getData<MerchantCampaignsCacheSnapshot>(targetKey);
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
    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);

    try {
      const response = await fetchMerchantCampaigns({
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
        swrCache.getData<MerchantCampaignsCacheSnapshot>(targetKey);
      const merged = mergeCampaignsById(
        latestSnapshot?.items ?? currentSnapshot.items,
        response.items,
      );

      swrCache.set<MerchantCampaignsCacheSnapshot>(
        targetKey,
        {
          items: merged,
          nextPage: response.nextPage,
          total: response.total,
        },
        MERCHANT_CAMPAIGNS_CACHE_TTL_MS,
      );

      setErrorState({ key: targetKey, error: null });
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
      inFlightPagesRef.current.delete(targetPage);
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      if (
        isMountedRef.current &&
        requestSeqRef.current === requestId &&
        activeCacheKeyRef.current === targetKey
      ) {
        isLoadingMoreRef.current = false;
        setIsLoadingMore(false);
      }
    }
  }, [cacheKey, isLoading, isRefreshing, pageSize, statusParam]);

  useEffect(() => {
    if (!cacheKey) {
      return;
    }

    const snapshot = swrCache.getSnapshot<MerchantCampaignsCacheSnapshot>(cacheKey);
    if (snapshot?.isFresh || inFlightPagesRef.current.has(1)) {
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const targetKey = cacheKey;
    const requestId = ++requestSeqRef.current;
    inFlightPagesRef.current.add(1);

    fetchMerchantCampaigns({
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
  }, [applyFirstPageSnapshot, cacheKey, pageSize, statusParam]);

  useFocusEffect(
    useCallback(() => {
      if (!cacheKey) {
        return;
      }
      const snapshot = swrCache.getSnapshot<MerchantCampaignsCacheSnapshot>(cacheKey);
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
    statusFilter,
    setStatusFilter,
    hasLoaded,
    isLoading,
    isRefreshing,
    isLoadingMore,
    errorMessage,
    refresh,
    loadMore,
  };
}

export function useMerchantCampaignDetail(campaignId: string) {
  const { user, activeRole } = useAuth();
  const { locale, t } = useLocale();
  const isFocused = useIsFocused();
  const appStateRef = useRef<string | null | undefined>(AppState.currentState);

  const cacheKey =
    user && activeRole === 'merchant' && campaignId
      ? getMerchantCampaignDetailCacheKey(user.id, campaignId)
      : null;

  const { data, isLoading, isRefreshing, error, refresh } =
    useSWRResource<MerchantCampaign>({
      key: cacheKey,
      fetcher: () => fetchMerchantCampaignById(campaignId),
      ttlMs: MERCHANT_CAMPAIGNS_CACHE_TTL_MS,
      enabled: Boolean(cacheKey),
    });

  const [isClosing, setIsClosing] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [justClosed, setJustClosed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!cacheKey) {
        return;
      }
      const snapshot = swrCache.getSnapshot<MerchantCampaign>(cacheKey);
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

  const closeCampaign = useCallback(async (): Promise<boolean> => {
    if (!user || activeRole !== 'merchant' || !campaignId || !cacheKey) {
      return false;
    }

    if (inFlightCloseCampaigns.has(campaignId)) {
      return false;
    }

    inFlightCloseCampaigns.add(campaignId);
    setIsClosing(true);
    setCloseError(null);

    try {
      const updated = await closeMerchantCampaign(campaignId);
      swrCache.set(cacheKey, updated, MERCHANT_CAMPAIGNS_CACHE_TTL_MS);
      invalidateMerchantCampaignRelatedCaches(user.id);
      setJustClosed(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
      return true;
    } catch (err) {
      const mapped = mapApiErrorToMessage(err, locale) || t.merchant.campaigns.closeFailed;
      setCloseError(mapped);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => undefined,
      );
      return false;
    } finally {
      inFlightCloseCampaigns.delete(campaignId);
      setIsClosing(false);
    }
  }, [activeRole, cacheKey, campaignId, locale, t.merchant.campaigns.closeFailed, user]);

  const errorMessage = useMemo(
    () => (error ? mapApiErrorToMessage(error, locale) : null),
    [error, locale],
  );

  return {
    campaign: data,
    isLoading,
    isRefreshing,
    isClosing,
    justClosed,
    errorMessage,
    closeError,
    refresh,
    closeCampaign,
  };
}

const PREVIEW_DEBOUNCE_MS = 400;

export function useCreateMerchantCampaign() {
  const { user, activeRole } = useAuth();
  const { locale, t } = useLocale();
  const router = useRouter();

  const [draft, setDraft] = useState<CampaignDraftFormInput>(() => ({
    productName: '',
    description: '',
    imageUrl: '',
    originalPrice: '',
    discountPercent: '',
    commissionAmount: '',
    maxItems: '',
    endsAt: buildFutureIsoFromDays(7),
  }));

  const [fieldErrors, setFieldErrors] = useState<CampaignDraftFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const [previewState, setPreviewState] = useState<{
    fingerprint: string;
    attemptSeq: number;
    preview: CampaignPreview | null;
    errorMessage: string | null;
  } | null>(null);
  const [previewRetrySeq, setPreviewRetrySeq] = useState(0);

  const isLaunchingRef = useRef(false);
  const idempotencySlotRef = useRef<{ fingerprint: string; key: string } | null>(null);

  const updateField = useCallback(
    <K extends keyof CampaignDraftFormInput>(
      field: K,
      value: CampaignDraftFormInput[K],
    ) => {
      setDraft((prev) => ({ ...prev, [field]: value }));
      setFieldErrors((prev) =>
        prev[field] ? { ...prev, [field]: undefined } : prev,
      );
      setSubmitError(null);

      if (
        field === 'originalPrice' ||
        field === 'discountPercent' ||
        field === 'commissionAmount' ||
        field === 'maxItems'
      ) {
        setPreviewState(null);
        setPreviewRetrySeq(0);
      }
    },
    [],
  );

  const selectEndsAtDate = useCallback(
    (date: Date) => {
      const nextIso = buildEndOfDayIso(date);
      if (!nextIso) {
        return;
      }
      idempotencySlotRef.current = null;
      updateField('endsAt', nextIso);
    },
    [updateField],
  );

  const previewInput = useMemo(
    () =>
      parsePreviewInputFromDraft({
        originalPrice: draft.originalPrice,
        discountPercent: draft.discountPercent,
        commissionAmount: draft.commissionAmount,
        maxItems: draft.maxItems,
      }),
    [
      draft.commissionAmount,
      draft.discountPercent,
      draft.maxItems,
      draft.originalPrice,
    ],
  );

  const previewFingerprint = useMemo(
    () => (previewInput ? JSON.stringify(previewInput) : null),
    [previewInput],
  );

  const isCurrentPreviewSettled = Boolean(
    previewFingerprint &&
      previewState &&
      previewState.fingerprint === previewFingerprint &&
      previewState.attemptSeq === previewRetrySeq,
  );
  const isPreviewLoading = Boolean(previewFingerprint && !isCurrentPreviewSettled);
  const preview = isCurrentPreviewSettled ? (previewState?.preview ?? null) : null;
  const previewError = isCurrentPreviewSettled
    ? (previewState?.errorMessage ?? null)
    : null;

  const retryPreview = useCallback(() => {
    if (!previewFingerprint) {
      return;
    }
    setPreviewState(null);
    setPreviewRetrySeq((prev) => prev + 1);
  }, [previewFingerprint]);

  useEffect(() => {
    if (!previewInput || !previewFingerprint) {
      setPreviewState(null);
      return undefined;
    }

    const controller = new AbortController();
    const attemptSeq = previewRetrySeq;
    const delayMs = attemptSeq > 0 ? 0 : PREVIEW_DEBOUNCE_MS;

    const timerId = setTimeout(() => {
      previewMerchantCampaign(previewInput, controller.signal)
        .then((result) => {
          if (controller.signal.aborted) {
            return;
          }
          setPreviewState({
            fingerprint: previewFingerprint,
            attemptSeq,
            preview: result,
            errorMessage: null,
          });
        })
        .catch((err) => {
          if (controller.signal.aborted) {
            return;
          }
          setPreviewState({
            fingerprint: previewFingerprint,
            attemptSeq,
            preview: null,
            errorMessage: mapApiErrorToMessage(err, locale),
          });
        });
    }, delayMs);

    return () => {
      clearTimeout(timerId);
      controller.abort();
    };
  }, [locale, previewFingerprint, previewInput, previewRetrySeq]);

  const submit = useCallback(async (): Promise<boolean> => {
    if (!user || activeRole !== 'merchant' || isLaunchingRef.current) {
      return false;
    }

    const validation = validateCampaignDraft(draft, t);
    setFieldErrors(validation.fieldErrors);

    if (!validation.isValid || !validation.launchInput) {
      setSubmitError(null);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => undefined,
      );
      return false;
    }

    const payloadFingerprint = JSON.stringify(validation.launchInput);
    const idempotencyKey =
      idempotencySlotRef.current?.fingerprint === payloadFingerprint
        ? idempotencySlotRef.current.key
        : createIdempotencyKey();
    idempotencySlotRef.current = {
      fingerprint: payloadFingerprint,
      key: idempotencyKey,
    };

    isLaunchingRef.current = true;
    setIsLaunching(true);
    setSubmitError(null);

    try {
      const created = await launchMerchantCampaign(
        validation.launchInput,
        idempotencyKey,
      );
      idempotencySlotRef.current = null;

      swrCache.set(
        getMerchantCampaignDetailCacheKey(user.id, created.id),
        created,
        MERCHANT_CAMPAIGNS_CACHE_TTL_MS,
      );
      invalidateMerchantCampaignRelatedCaches(user.id);

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
      router.replace(`/merchant/campaigns/${created.id}` as Href);
      return true;
    } catch (err) {
      if (
        isApiClientError(err) &&
        (err.code === 'IDEMPOTENCY_KEY_REUSED' || err.code === 'VALIDATION_ERROR')
      ) {
        idempotencySlotRef.current = null;
      }

      const apiFields = extractFieldErrors(err);
      const pickFirst = (key: string): string | undefined => {
        const list = apiFields[key];
        return Array.isArray(list) && typeof list[0] === 'string' && list[0].trim().length > 0
          ? list[0]
          : undefined;
      };

      const productNameErr = pickFirst('productName');
      const descriptionErr = pickFirst('description');
      const imageUrlErr = pickFirst('imageUrl');
      const originalPriceErr = pickFirst('originalPriceSyp');
      const discountPercentErr = pickFirst('discountPercent');
      const commissionAmountErr = pickFirst('commission.amountSyp');
      const maxItemsErr = pickFirst('maxItems');
      const endsAtErr = pickFirst('endsAt');

      if (
        productNameErr ||
        descriptionErr ||
        imageUrlErr ||
        originalPriceErr ||
        discountPercentErr ||
        commissionAmountErr ||
        maxItemsErr ||
        endsAtErr
      ) {
        setFieldErrors((prev) => ({
          ...prev,
          ...(productNameErr ? { productName: productNameErr } : {}),
          ...(descriptionErr ? { description: descriptionErr } : {}),
          ...(imageUrlErr ? { imageUrl: imageUrlErr } : {}),
          ...(originalPriceErr ? { originalPrice: originalPriceErr } : {}),
          ...(discountPercentErr ? { discountPercent: discountPercentErr } : {}),
          ...(commissionAmountErr ? { commissionAmount: commissionAmountErr } : {}),
          ...(maxItemsErr ? { maxItems: maxItemsErr } : {}),
          ...(endsAtErr ? { endsAt: endsAtErr } : {}),
        }));
      }

      setSubmitError(mapApiErrorToMessage(err, locale));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => undefined,
      );
      return false;
    } finally {
      isLaunchingRef.current = false;
      setIsLaunching(false);
    }
  }, [activeRole, draft, locale, router, t, user]);

  return {
    draft,
    fieldErrors,
    submitError,
    preview,
    previewError,
    isPreviewLoading,
    hasCompletePreviewInputs: Boolean(previewInput),
    isLaunching,
    updateField,
    selectEndsAtDate,
    retryPreview,
    submit,
  };
}
