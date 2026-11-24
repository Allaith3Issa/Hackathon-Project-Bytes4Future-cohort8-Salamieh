import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import {
  hasCustomerRole,
  hasMarketerRole,
  hasMerchantRole,
  useAuth,
} from '@/core/auth';
import { Colors } from '@/core/theme';
import { extractReferralCode } from '@/features/customer/offers';

function resolveReferralCodeParam(
  rawCodeParam: string | string[] | undefined,
  incomingUrl: string | null,
): string | null {
  if (incomingUrl) {
    const parsed = Linking.parse(incomingUrl);
    const queryCode = parsed.queryParams?.code;
    const queryCandidates = Array.isArray(queryCode)
      ? queryCode
      : queryCode
        ? [queryCode]
        : [];
    for (const candidate of queryCandidates) {
      if (typeof candidate === 'string') {
        const extracted = extractReferralCode(candidate);
        if (extracted) {
          return extracted;
        }
      }
    }
  }

  const routeCandidates = Array.isArray(rawCodeParam)
    ? rawCodeParam
    : rawCodeParam
      ? [rawCodeParam]
      : [];
  for (const candidate of routeCandidates) {
    const extracted = extractReferralCode(candidate);
    if (extracted) {
      return extracted;
    }
  }

  if (incomingUrl) {
    const fromUrl = extractReferralCode(incomingUrl);
    if (fromUrl) {
      return fromUrl;
    }
  }

  return null;
}

export default function ReferralDeepLinkScreen() {
  const router = useRouter();
  const { code: rawCodeParam } = useLocalSearchParams<{
    code?: string | string[];
  }>();
  const incomingUrl = Linking.useURL();
  const {
    status,
    user,
    activeRole,
    hydrationError,
    setPendingReferralCode,
    switchWorkspaceRole,
  } = useAuth();

  const resolvedCode = useMemo(
    () => resolveReferralCodeParam(rawCodeParam, incomingUrl),
    [incomingUrl, rawCodeParam],
  );

  const lastStoredCodeRef = useRef<string | null>(null);
  const switchingToCustomerRef = useRef(false);
  const redirectedTargetRef = useRef<string | null>(null);

  useEffect(() => {
    if (resolvedCode && lastStoredCodeRef.current !== resolvedCode) {
      lastStoredCodeRef.current = resolvedCode;
      setPendingReferralCode(resolvedCode);
    }
  }, [resolvedCode, setPendingReferralCode]);

  useEffect(() => {
    if (status === 'hydrating') {
      if (hydrationError !== null) {
        const fallbackTarget = '/';
        if (redirectedTargetRef.current !== fallbackTarget) {
          redirectedTargetRef.current = fallbackTarget;
          router.replace('/' as Href);
        }
      }
      return;
    }

    if (status === 'unauthenticated' || user === null) {
      const loginTarget = '/(auth)/login';
      if (redirectedTargetRef.current !== loginTarget) {
        redirectedTargetRef.current = loginTarget;
        router.replace(loginTarget as Href);
      }
      return;
    }

    if (hasCustomerRole(user)) {
      if (activeRole !== 'customer') {
        if (!switchingToCustomerRef.current) {
          switchingToCustomerRef.current = true;
          void switchWorkspaceRole('customer').finally(() => {
            switchingToCustomerRef.current = false;
          });
        }
        return;
      }

      const customerHref = resolvedCode
        ? (`/customer?code=${encodeURIComponent(resolvedCode)}` as Href)
        : ('/customer' as Href);
      const targetKey = String(customerHref);
      if (redirectedTargetRef.current !== targetKey) {
        redirectedTargetRef.current = targetKey;
        router.replace(customerHref);
      }
      return;
    }

    const fallbackHref: Href =
      activeRole === 'marketer' && hasMarketerRole(user)
        ? ('/marketer' as Href)
        : activeRole === 'merchant' && hasMerchantRole(user)
          ? ('/merchant' as Href)
          : ('/workspace-select' as Href);
    const fallbackKey = String(fallbackHref);
    if (redirectedTargetRef.current !== fallbackKey) {
      redirectedTargetRef.current = fallbackKey;
      router.replace(fallbackHref);
    }
  }, [
    activeRole,
    hydrationError,
    resolvedCode,
    router,
    status,
    switchWorkspaceRole,
    user,
  ]);

  return (
    <View style={styles.root}>
      <ActivityIndicator size="small" color={Colors.action} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
