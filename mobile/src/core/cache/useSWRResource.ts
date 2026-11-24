import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { swrCache } from './swrCache';

export interface UseSWRResourceOptions<T> {
  key: string | null;
  fetcher: () => Promise<T>;
  ttlMs: number;
  enabled?: boolean;
}

export interface UseSWRResourceResult<T> {
  data: T | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: unknown;
  refresh: (force?: boolean) => Promise<T | null>;
  applyOptimistic: (updater: (current: T) => T) => () => void;
}

const NOOP_SUBSCRIBE = () => () => undefined;
const NULL_SNAPSHOT = () => null;

export function useSWRResource<T>({
  key,
  fetcher,
  ttlMs,
  enabled = true,
}: UseSWRResourceOptions<T>): UseSWRResourceResult<T> {
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const subscribe = useCallback(
    (listener: () => void) => (key ? swrCache.subscribe(key, listener) : NOOP_SUBSCRIBE()),
    [key],
  );
  const getSnapshot = useCallback(
    () => (key ? swrCache.getData<T>(key) : NULL_SNAPSHOT()),
    [key],
  );

  const data = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [refreshingState, setRefreshingState] = useState<{
    key: string | null;
    active: boolean;
  }>({
    key: null,
    active: false,
  });
  const [errorState, setErrorState] = useState<{ key: string | null; error: unknown }>({
    key: null,
    error: null,
  });

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const activeKeyRef = useRef<string | null>(key);
  activeKeyRef.current = key;
  const refreshIdRef = useRef(0);

  const activeError = errorState.key === key ? errorState.error : null;
  const isRefreshing = Boolean(
    key && enabled && refreshingState.key === key && refreshingState.active,
  );
  const isLoading = Boolean(key && enabled && data === null && activeError === null);

  useEffect(() => {
    if (!key || !enabled) {
      return;
    }

    const snap = swrCache.getSnapshot<T>(key);
    if (snap?.isFresh) {
      return;
    }

    const targetKey = key;
    let cancelled = false;
    swrCache
      .revalidate(targetKey, () => fetcherRef.current(), {
        ttlMs,
        force: !snap,
      })
      .then(() => {
        if (!cancelled && isMountedRef.current && activeKeyRef.current === targetKey) {
          setErrorState({ key: targetKey, error: null });
        }
      })
      .catch((err) => {
        if (!cancelled && isMountedRef.current && activeKeyRef.current === targetKey) {
          setErrorState({ key: targetKey, error: err });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, key, ttlMs]);

  const refresh = useCallback(
    async (force = true): Promise<T | null> => {
      if (!key || !enabled) {
        return null;
      }

      const targetKey = key;
      const callId = ++refreshIdRef.current;

      setRefreshingState({ key: targetKey, active: true });
      setErrorState({ key: targetKey, error: null });

      try {
        return await swrCache.revalidate(targetKey, () => fetcherRef.current(), {
          ttlMs,
          force,
        });
      } catch (err) {
        if (isMountedRef.current && activeKeyRef.current === targetKey) {
          setErrorState({ key: targetKey, error: err });
        }
        return null;
      } finally {
        if (
          isMountedRef.current &&
          activeKeyRef.current === targetKey &&
          refreshIdRef.current === callId
        ) {
          setRefreshingState({ key: targetKey, active: false });
        }
      }
    },
    [enabled, key, ttlMs],
  );

  const applyOptimistic = useCallback(
    (updater: (current: T) => T): (() => void) => {
      if (!key) {
        return () => undefined;
      }
      const targetKey = key;
      const snapshot = swrCache.getSnapshot<T>(targetKey);
      if (!snapshot) {
        return () => undefined;
      }

      const previousData = snapshot.data;
      const nextData = updater(previousData);
      swrCache.set(targetKey, nextData, ttlMs);
      const optimisticVersion = swrCache.getKeyVersion(targetKey);

      return () => {
        const currentVersion = swrCache.getKeyVersion(targetKey);
        if (
          currentVersion.cacheEpoch !== optimisticVersion.cacheEpoch ||
          currentVersion.keyVersion !== optimisticVersion.keyVersion
        ) {
          return;
        }
        swrCache.set(targetKey, previousData, ttlMs);
      };
    },
    [key, ttlMs],
  );

  return {
    data,
    isLoading,
    isRefreshing,
    error: activeError,
    refresh,
    applyOptimistic,
  };
}
