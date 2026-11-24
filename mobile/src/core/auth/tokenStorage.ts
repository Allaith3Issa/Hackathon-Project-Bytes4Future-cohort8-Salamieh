import * as SecureStore from 'expo-secure-store';

import type { MobileWorkspaceRole } from './types';

const ACCESS_TOKEN_KEY = 'alsalamiyah_access_token';
const REFRESH_TOKEN_KEY = 'alsalamiyah_refresh_token';
const ACTIVE_ROLE_KEY = 'alsalamiyah_active_workspace_role';

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

interface StoredActiveRolePayload {
  userId: string;
  role: MobileWorkspaceRole;
}

/**
 * Tokens and active workspace role choice are persisted exclusively in
 * Expo SecureStore (encrypted device keystore).
 * Never store tokens in AsyncStorage, regular SWR cache, logs, or URLs.
 */
export const tokenStorage = {
  async saveTokens(tokens: StoredTokens): Promise<void> {
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken),
      SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken),
    ]);
  },

  async getAccessToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    } catch {
      return null;
    }
  },

  async getRefreshToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    } catch {
      return null;
    }
  },

  async saveActiveRole(userId: string, role: MobileWorkspaceRole): Promise<void> {
    const payload: StoredActiveRolePayload = { userId, role };
    await SecureStore.setItemAsync(ACTIVE_ROLE_KEY, JSON.stringify(payload));
  },

  async getActiveRole(userId: string): Promise<MobileWorkspaceRole | null> {
    try {
      const raw = await SecureStore.getItemAsync(ACTIVE_ROLE_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as Partial<StoredActiveRolePayload> | null;
      if (
        !parsed ||
        parsed.userId !== userId ||
        (parsed.role !== 'customer' &&
          parsed.role !== 'marketer' &&
          parsed.role !== 'merchant')
      ) {
        return null;
      }
      return parsed.role;
    } catch {
      return null;
    }
  },

  async clearActiveRole(): Promise<void> {
    await SecureStore.deleteItemAsync(ACTIVE_ROLE_KEY).catch(() => undefined);
  },

  async clearTokens(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY).catch(() => undefined),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => undefined),
      SecureStore.deleteItemAsync(ACTIVE_ROLE_KEY).catch(() => undefined),
    ]);
  },
};
