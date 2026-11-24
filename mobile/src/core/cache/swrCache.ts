import type { MobileWorkspaceRole } from '../auth/types';

export interface CacheEntry<T> {
  data: T;
  updatedAt: number;
  ttlMs: number;
}

export interface CacheSnapshot<T> {
  data: T;
  isFresh: boolean;
  updatedAt: number;
}

export interface CacheKeyVersion {
  cacheEpoch: number;
  keyVersion: number;
}

type CacheListener = () => void;

/**
 * Namespace every authenticated cache key by userId and active workspace role
 * (${userId}:${role}:...) so switching accounts or switching roles for dual-role
 * accounts never leaks stale cross-role data.
 */
export function buildRoleCacheKey(
  userId: string,
  role: MobileWorkspaceRole,
  resourceKey: string,
): string {
  return `${userId}:${role}:${resourceKey}`;
}

class SwrMemoryCache {
  private readonly entries = new Map<string, CacheEntry<unknown>>();
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private readonly listeners = new Map<string, Set<CacheListener>>();
  private readonly keyVersions = new Map<string, number>();
  private cacheEpoch = 0;

  getKeyVersion(key: string): CacheKeyVersion {
    return {
      cacheEpoch: this.cacheEpoch,
      keyVersion: this.keyVersions.get(key) ?? 0,
    };
  }

  private bumpKeyVersion(key: string): number {
    const nextVersion = (this.keyVersions.get(key) ?? 0) + 1;
    this.keyVersions.set(key, nextVersion);
    return nextVersion;
  }

  getData<T>(key: string): T | null {
    const entry = this.entries.get(key) as CacheEntry<T> | undefined;
    return entry ? entry.data : null;
  }

  getSnapshot<T>(key: string): CacheSnapshot<T> | null {
    const entry = this.entries.get(key) as CacheEntry<T> | undefined;
    if (!entry) {
      return null;
    }

    const isFresh =
      entry.updatedAt > 0 && Date.now() - entry.updatedAt < entry.ttlMs;
    return {
      data: entry.data,
      isFresh,
      updatedAt: entry.updatedAt,
    };
  }

  isRevalidating(key: string): boolean {
    return this.inFlight.has(key);
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    this.bumpKeyVersion(key);
    this.entries.set(key, {
      data,
      updatedAt: Date.now(),
      ttlMs,
    });
    this.notify(key);
  }

  markStale(key: string): void {
    this.bumpKeyVersion(key);
    this.inFlight.delete(key);

    const existing = this.entries.get(key);
    if (existing) {
      this.entries.set(key, {
        ...existing,
        updatedAt: 0,
      });
      this.notify(key);
    }
  }

  markStalePrefix(prefix: string): void {
    const matchingKeys = new Set<string>();
    for (const key of this.entries.keys()) {
      if (key.startsWith(prefix)) {
        matchingKeys.add(key);
      }
    }
    for (const key of this.inFlight.keys()) {
      if (key.startsWith(prefix)) {
        matchingKeys.add(key);
      }
    }

    for (const key of matchingKeys) {
      this.bumpKeyVersion(key);
      this.inFlight.delete(key);

      const existing = this.entries.get(key);
      if (existing) {
        this.entries.set(key, {
          ...existing,
          updatedAt: 0,
        });
        this.notify(key);
      }
    }
  }

  invalidate(key: string): void {
    this.bumpKeyVersion(key);
    this.inFlight.delete(key);
    this.entries.delete(key);
    this.notify(key);
  }

  invalidateUserRole(userId: string, role: MobileWorkspaceRole): void {
    this.invalidatePrefix(`${userId}:${role}:`);
  }

  invalidatePrefix(prefix: string): void {
    const matchingKeys = new Set<string>();
    for (const key of this.entries.keys()) {
      if (key.startsWith(prefix)) {
        matchingKeys.add(key);
      }
    }
    for (const key of this.inFlight.keys()) {
      if (key.startsWith(prefix)) {
        matchingKeys.add(key);
      }
    }

    for (const key of matchingKeys) {
      this.bumpKeyVersion(key);
      this.inFlight.delete(key);
      this.entries.delete(key);
      this.notify(key);
    }
  }

  clear(): void {
    this.cacheEpoch += 1;
    this.keyVersions.clear();
    const keys = Array.from(this.entries.keys());
    this.entries.clear();
    this.inFlight.clear();
    for (const key of keys) {
      this.notify(key);
    }
  }

  subscribe(key: string, listener: CacheListener): () => void {
    let keyListeners = this.listeners.get(key);
    if (!keyListeners) {
      keyListeners = new Set();
      this.listeners.set(key, keyListeners);
    }
    keyListeners.add(listener);

    return () => {
      const current = this.listeners.get(key);
      if (!current) {
        return;
      }
      current.delete(listener);
      if (current.size === 0) {
        this.listeners.delete(key);
      }
    };
  }

  async revalidate<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: { ttlMs: number; force?: boolean },
  ): Promise<T> {
    if (!options.force) {
      const snapshot = this.getSnapshot<T>(key);
      if (snapshot?.isFresh) {
        return snapshot.data;
      }
    }

    const existingPromise = this.inFlight.get(key) as Promise<T> | undefined;
    if (existingPromise) {
      return existingPromise;
    }

    const startEpoch = this.cacheEpoch;
    const startKeyVersion = this.keyVersions.get(key) ?? 0;

    const fetchPromise = fetcher()
      .then((result) => {
        const currentKeyVersion = this.keyVersions.get(key) ?? 0;
        if (this.cacheEpoch === startEpoch && currentKeyVersion === startKeyVersion) {
          this.set(key, result, options.ttlMs);
        }
        return result;
      })
      .finally(() => {
        if (this.inFlight.get(key) === fetchPromise) {
          this.inFlight.delete(key);
        }
      });

    this.inFlight.set(key, fetchPromise);
    return fetchPromise;
  }

  private notify(key: string): void {
    const keyListeners = this.listeners.get(key);
    if (!keyListeners) {
      return;
    }
    for (const listener of keyListeners) {
      listener();
    }
  }
}

export const swrCache = new SwrMemoryCache();
