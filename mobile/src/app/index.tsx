import { useIsFocused, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui';
import { mapApiErrorToMessage } from '@/core/api';
import {
  hasCustomerRole,
  hasMarketerRole,
  hasMerchantRole,
  useAuth,
} from '@/core/auth';
import { useLocale } from '@/core/i18n';
import { getDirectionalTextStyle } from '@/core/rtl';
import { BorderWidth, Colors, Radii, Spacing, Typography } from '@/core/theme';
import { useSignOut } from '@/features/auth';

export default function RootIndexGate() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { locale, isLocaleReady, t } = useLocale();
  const {
    status,
    user,
    activeRole,
    hydrationError,
    pendingReferralCode,
    retryHydration,
  } = useAuth();
  const { isSigningOut, signOut } = useSignOut();
  const hasRedirectedRef = useRef(false);

  const handleSignOut = useCallback(() => {
    void signOut();
  }, [signOut]);

  useEffect(() => {
    if (!isFocused) {
      hasRedirectedRef.current = false;
      return;
    }

    if (!isLocaleReady || status === 'hydrating' || hasRedirectedRef.current) {
      return;
    }

    const isAuthenticated = status === 'authenticated' && user !== null;
    let target: Href;

    if (!isAuthenticated) {
      target = '/(auth)/login' as Href;
    } else if (activeRole === 'customer' && hasCustomerRole(user)) {
      target = pendingReferralCode
        ? (`/customer?code=${encodeURIComponent(pendingReferralCode)}` as Href)
        : ('/customer' as Href);
    } else if (activeRole === 'marketer' && hasMarketerRole(user)) {
      target = '/marketer' as Href;
    } else if (activeRole === 'merchant' && hasMerchantRole(user)) {
      target = '/merchant' as Href;
    } else {
      target = '/workspace-select' as Href;
    }

    hasRedirectedRef.current = true;
    router.replace(target);
  }, [activeRole, isFocused, isLocaleReady, pendingReferralCode, router, status, user]);

  if (status === 'hydrating' && hydrationError !== null) {
    const directionalText = getDirectionalTextStyle(locale);

    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.centerWrap}>
          <View style={styles.recoveryCard}>
            <Text style={[Typography.section, directionalText, styles.titleText]}>
              {t.common.appName}
            </Text>
            <Text style={[Typography.body, directionalText, styles.messageText]}>
              {mapApiErrorToMessage(hydrationError, locale)}
            </Text>
            <View style={styles.actionsColumn}>
              <AppButton
                testID="root-hydration-retry-button"
                label={t.common.retry}
                onPress={retryHydration}
                disabled={isSigningOut}
              />
              <AppButton
                testID="root-hydration-signout-button"
                variant="ghost"
                label={t.profile.signOut}
                loading={isSigningOut}
                onPress={handleSignOut}
              />
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (status === 'hydrating') {
    return (
      <View style={[styles.root, styles.centerWrap]}>
        <ActivityIndicator size="small" color={Colors.action} />
      </View>
    );
  }

  return <View style={styles.root} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.gutter,
  },
  recoveryCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Colors.surface,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.gutter,
    gap: Spacing.gutter,
  },
  titleText: {
    color: Colors.ink,
    textAlign: 'center',
  },
  messageText: {
    color: Colors.muted,
    textAlign: 'center',
  },
  actionsColumn: {
    gap: Spacing.compact,
    marginTop: Spacing.compact,
  },
});
