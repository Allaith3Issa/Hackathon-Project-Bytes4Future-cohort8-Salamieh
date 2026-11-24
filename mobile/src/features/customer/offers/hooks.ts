import * as Haptics from 'expo-haptics';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { isApiClientError, mapApiErrorToMessage } from '@/core/api';
import { useAuth } from '@/core/auth';
import { buildRoleCacheKey, swrCache } from '@/core/cache';
import { useLocale } from '@/core/i18n';
import {
  fetchPublicOffer,
  issueCustomerOfferQr,
  recordReferralClick,
} from './api';
import { extractReferralCode } from './types';
import type {
  OfferQrPass,
  PublicOffer,
  RecentOpenedOfferEntry,
} from './types';

const CUSTOMER_RECENT_OFFERS_RESOURCE = 'offers:recent';
const RECENT_OFFERS_TTL_MS = 30 * 60 * 1000;
const MAX_RECENT_OFFERS = 10;
const EMPTY_RECENT_OFFERS: RecentOpenedOfferEntry[] = [];

const NOOP_SUBSCRIBE = () => () => undefined;
const EMPTY_RECENT_SNAPSHOT = () => EMPTY_RECENT_OFFERS;

export function getCustomerRecentOffersCacheKey(userId: string): string {
  return buildRoleCacheKey(userId, 'customer', CUSTOMER_RECENT_OFFERS_RESOURCE);
}

function recordRecentOpenedOffer(
  userId: string,
  code: string,
  offer: PublicOffer,
): void {
  const key = getCustomerRecentOffersCacheKey(userId);
  const existing = swrCache.getData<RecentOpenedOfferEntry[]>(key) ?? [];
  const nextEntry: RecentOpenedOfferEntry = {
    code,
    campaignId: offer.campaignId,
    productName: offer.productName,
    shopName: offer.shopName,
    openedAt: new Date().toISOString(),
  };

  const filtered = existing.filter((item) => item.code !== code);
  const nextList = [nextEntry, ...filtered].slice(0, MAX_RECENT_OFFERS);
  swrCache.set(key, nextList, RECENT_OFFERS_TTL_MS);
}

/**
 * Reads customer-isolated recent referral lookups from SWR memory cache.
 * Stores non-sensitive code/title metadata only (no qrToken or auth tokens).
 */
export function useCustomerRecentOffers() {
  const { user, activeRole } = useAuth();
  const cacheKey =
    user && activeRole === 'customer'
      ? getCustomerRecentOffersCacheKey(user.id)
      : null;

  const subscribe = useCallback(
    (listener: () => void) =>
      cacheKey ? swrCache.subscribe(cacheKey, listener) : NOOP_SUBSCRIBE(),
    [cacheKey],
  );

  const getSnapshot = useCallback(
    () =>
      cacheKey
        ? (swrCache.getData<RecentOpenedOfferEntry[]>(cacheKey) ?? EMPTY_RECENT_OFFERS)
        : EMPTY_RECENT_SNAPSHOT(),
    [cacheKey],
  );

  const recentOffers = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const clearRecentOffers = useCallback(() => {
    if (!cacheKey) {
      return;
    }
    swrCache.invalidate(cacheKey);
  }, [cacheKey]);

  return {
    recentOffers,
    clearRecentOffers,
  };
}

/**
 * Resolves referral offers by link or code, logs at most one click per code per session
 * via Set<string>, and appends non-sensitive opened codes into customer SWR cache.
 */
export function usePublicOfferLookup() {
  const { user, activeRole } = useAuth();
  const { locale, t } = useLocale();

  const [rawInput, setRawInputState] = useState('');
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [offer, setOffer] = useState<PublicOffer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  // Deduplicates referral clicks per code within the current session and concurrent fetches.
  const clickedCodesRef = useRef<Set<string>>(new Set());
  const inFlightLookupCodesRef = useRef<Set<string>>(new Set());
  const requestSeqRef = useRef(0);
  const activeCodeRef = useRef<string | null>(null);
  const lastSessionScopeRef = useRef<string | null>(null);

  useEffect(() => {
    activeCodeRef.current = activeCode;
  }, [activeCode]);

  const sessionScopeKey =
    user && activeRole === 'customer' ? `${user.id}:${activeRole}` : null;

  useEffect(() => {
    if (lastSessionScopeRef.current !== sessionScopeKey) {
      lastSessionScopeRef.current = sessionScopeKey;
      clickedCodesRef.current.clear();
      inFlightLookupCodesRef.current.clear();
      requestSeqRef.current += 1;
      activeCodeRef.current = null;
      setRawInputState('');
      setActiveCode(null);
      setOffer(null);
      setIsLoading(false);
      setIsRefreshing(false);
      setValidationError(null);
      setError(null);
      setErrorCode(null);
    }
  }, [sessionScopeKey]);

  const setRawInput = useCallback((value: string) => {
    setRawInputState(value);
    setValidationError(null);
  }, []);

  const executeLookup = useCallback(
    async (
      sourceInput: string,
      options: { isRefresh?: boolean } = {},
    ): Promise<PublicOffer | null> => {
      const code = extractReferralCode(sourceInput);
      if (!code) {
        setValidationError(t.customer.offers.invalidCodeError);
        setError(null);
        setErrorCode(null);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
          () => undefined,
        );
        return null;
      }

      if (inFlightLookupCodesRef.current.has(code)) {
        return null;
      }

      const requestId = ++requestSeqRef.current;
      inFlightLookupCodesRef.current.add(code);
      setValidationError(null);
      setError(null);
      setErrorCode(null);

      const isRefreshAction =
        Boolean(options.isRefresh) && activeCodeRef.current === code;
      if (isRefreshAction) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        const resolved = await fetchPublicOffer(code);
        if (requestSeqRef.current !== requestId) {
          return null;
        }

        activeCodeRef.current = code;
        setActiveCode(code);
        setOffer(resolved);
        setRawInputState(code);

        if (user && activeRole === 'customer') {
          recordRecentOpenedOffer(user.id, code, resolved);
        }

        if (resolved.status === 'active' && !clickedCodesRef.current.has(code)) {
          clickedCodesRef.current.add(code);
          void recordReferralClick(code).catch(() => undefined);
        }

        return resolved;
      } catch (err: unknown) {
        if (requestSeqRef.current !== requestId) {
          return null;
        }

        let shouldClearStaleOffer = !isRefreshAction;
        if (isApiClientError(err)) {
          setErrorCode(err.code);
          if (err.code === 'NOT_FOUND') {
            shouldClearStaleOffer = true;
            setError(t.customer.offers.offerNotFoundError);
          } else if (err.code === 'CAMPAIGN_ENDED') {
            shouldClearStaleOffer = true;
            setError(t.customer.offers.offerEndedError);
          } else {
            setError(mapApiErrorToMessage(err, locale));
          }
        } else {
          setErrorCode('UNKNOWN_ERROR');
          setError(t.customer.offers.loadError);
        }

        if (shouldClearStaleOffer) {
          setOffer(null);
          activeCodeRef.current = null;
          setActiveCode(null);
        }

        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
          () => undefined,
        );
        return null;
      } finally {
        inFlightLookupCodesRef.current.delete(code);
        if (requestSeqRef.current === requestId) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [
      activeRole,
      locale,
      t.customer.offers.invalidCodeError,
      t.customer.offers.loadError,
      t.customer.offers.offerEndedError,
      t.customer.offers.offerNotFoundError,
      user,
    ],
  );

  const lookupOffer = useCallback(
    (inputOverride?: string): Promise<PublicOffer | null> => {
      const targetInput = inputOverride ?? rawInput;
      if (inputOverride !== undefined) {
        setRawInputState(inputOverride);
      }
      return executeLookup(targetInput, { isRefresh: false });
    },
    [executeLookup, rawInput],
  );

  const refreshOffer = useCallback((): Promise<PublicOffer | null> => {
    const code = activeCodeRef.current;
    if (!code) {
      return Promise.resolve(null);
    }
    return executeLookup(code, { isRefresh: true });
  }, [executeLookup]);

  const clearOffer = useCallback(() => {
    requestSeqRef.current += 1;
    inFlightLookupCodesRef.current.clear();
    activeCodeRef.current = null;
    setRawInputState('');
    setActiveCode(null);
    setOffer(null);
    setIsLoading(false);
    setIsRefreshing(false);
    setValidationError(null);
    setError(null);
    setErrorCode(null);
  }, []);

  return {
    rawInput,
    setRawInput,
    activeCode,
    offer,
    isLoading,
    isRefreshing,
    validationError,
    error,
    errorCode,
    lookupOffer,
    refreshOffer,
    clearOffer,
  };
}

/**
 * Issues or retrieves the authoritative Offer QR pass directly from the server.
 * Prevents duplicate taps via Set<string> and keeps qrToken out of SWR cache.
 */
export function useCustomerOfferQr() {
  const { user, activeRole } = useAuth();
  const { locale, t } = useLocale();

  const [offerPass, setOfferPass] = useState<OfferQrPass | null>(null);
  const [isIssuing, setIsIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isSelfPromotionForbidden, setIsSelfPromotionForbidden] = useState(false);

  const inFlightIssueCodesRef = useRef<Set<string>>(new Set());
  const requestSeqRef = useRef(0);
  const lastSessionScopeRef = useRef<string | null>(null);

  const sessionScopeKey =
    user && activeRole === 'customer' ? `${user.id}:${activeRole}` : null;

  useEffect(() => {
    if (lastSessionScopeRef.current !== sessionScopeKey) {
      lastSessionScopeRef.current = sessionScopeKey;
      inFlightIssueCodesRef.current.clear();
      requestSeqRef.current += 1;
      setOfferPass(null);
      setIsIssuing(false);
      setError(null);
      setErrorCode(null);
      setIsSelfPromotionForbidden(false);
    }
  }, [sessionScopeKey]);

  const clearOfferPass = useCallback(() => {
    requestSeqRef.current += 1;
    inFlightIssueCodesRef.current.clear();
    setOfferPass(null);
    setIsIssuing(false);
    setError(null);
    setErrorCode(null);
    setIsSelfPromotionForbidden(false);
  }, []);

  const issueOfferQr = useCallback(
    async (rawCode: string): Promise<OfferQrPass | null> => {
      if (!user || activeRole !== 'customer') {
        return null;
      }

      const code = extractReferralCode(rawCode);
      if (!code) {
        setError(t.customer.offers.invalidCodeError);
        setErrorCode('VALIDATION_ERROR');
        setIsSelfPromotionForbidden(false);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
          () => undefined,
        );
        return null;
      }

      if (inFlightIssueCodesRef.current.has(code)) {
        return null;
      }

      const requestId = ++requestSeqRef.current;
      inFlightIssueCodesRef.current.add(code);
      setIsIssuing(true);
      setError(null);
      setErrorCode(null);
      setIsSelfPromotionForbidden(false);

      try {
        const pass = await issueCustomerOfferQr(code);
        if (requestSeqRef.current !== requestId) {
          return null;
        }

        setOfferPass(pass);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => undefined,
        );
        return pass;
      } catch (err: unknown) {
        if (requestSeqRef.current !== requestId) {
          return null;
        }

        if (isApiClientError(err)) {
          setErrorCode(err.code);

          if (err.code === 'SELF_PROMOTION_FORBIDDEN') {
            setIsSelfPromotionForbidden(true);
            setError(t.customer.offers.selfPromotionHint);
          } else if (err.code === 'CAMPAIGN_ENDED') {
            setOfferPass(null);
            setError(t.customer.offers.offerEndedError);
          } else if (err.code === 'NOT_FOUND') {
            setOfferPass(null);
            setError(t.customer.offers.offerNotFoundError);
          } else {
            setError(mapApiErrorToMessage(err, locale));
          }
        } else {
          setErrorCode('UNKNOWN_ERROR');
          setError(t.customer.offers.loadError);
        }

        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
          () => undefined,
        );
        return null;
      } finally {
        inFlightIssueCodesRef.current.delete(code);
        if (requestSeqRef.current === requestId) {
          setIsIssuing(false);
        }
      }
    },
    [
      activeRole,
      locale,
      t.customer.offers.invalidCodeError,
      t.customer.offers.loadError,
      t.customer.offers.offerEndedError,
      t.customer.offers.offerNotFoundError,
      t.customer.offers.selfPromotionHint,
      user,
    ],
  );

  return {
    offerPass,
    isIssuing,
    error,
    errorCode,
    isSelfPromotionForbidden,
    issueOfferQr,
    clearOfferPass,
  };
}
