import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, BrandMark, StatusBadge } from '@/components/ui';
import { useAuth } from '@/core/auth';
import type { MobileWorkspaceRole } from '@/core/auth';
import { useLocale } from '@/core/i18n';
import { useAndroidBack } from '@/core/navigation';
import { getDirectionalTextStyle } from '@/core/rtl';
import { BorderWidth, Colors, Radii, Spacing, Typography } from '@/core/theme';
import { useSignOut } from '@/features/profile';

export default function WorkspaceSelectScreen() {
  const { locale, t } = useLocale();
  const { user, availableRoles, switchWorkspaceRole } = useAuth();
  const { isSigningOut, signOut } = useSignOut();
  const reducedMotion = useReducedMotion();
  const [selectingRole, setSelectingRole] = useState<MobileWorkspaceRole | null>(null);

  const isBusy = selectingRole !== null || isSigningOut;

  useAndroidBack({
    enabled: true,
    isBusy,
    isRootTab: true,
  });

  const directionalText = getDirectionalTextStyle(locale);

  const handleSelectRole = useCallback(
    async (role: MobileWorkspaceRole) => {
      if (isBusy || !availableRoles.includes(role)) {
        return;
      }
      setSelectingRole(role);
      try {
        await switchWorkspaceRole(role);
      } finally {
        setSelectingRole(null);
      }
    },
    [availableRoles, isBusy, switchWorkspaceRole],
  );

  const handleSignOut = useCallback(() => {
    void signOut();
  }, [signOut]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          entering={reducedMotion ? undefined : FadeInDown.duration(220)}
          style={styles.brandRow}
        >
          <BrandMark size="lg" decorative />
          <View style={styles.brandMeta}>
            <Text style={[Typography.section, directionalText]}>
              {t.common.appName}
            </Text>
            {user ? (
              <Text style={[Typography.caption, directionalText]} numberOfLines={1}>
                {user.name}
              </Text>
            ) : null}
          </View>
        </Animated.View>

        <Animated.View
          entering={reducedMotion ? undefined : FadeInDown.delay(60).duration(240)}
          style={styles.card}
        >
          <View style={styles.badgesRow}>
            {availableRoles.includes('customer') ? (
              <StatusBadge label={t.profile.roleCustomer} tone="success" showDot />
            ) : null}
            {availableRoles.includes('marketer') ? (
              <StatusBadge label={t.profile.roleMarketer} tone="mauve" showDot />
            ) : null}
            {availableRoles.includes('merchant') ? (
              <StatusBadge label={t.profile.roleMerchant} tone="info" showDot />
            ) : null}
          </View>

          <Text style={[Typography.display, directionalText]}>
            {t.auth.chooseWorkspaceTitle}
          </Text>
          <Text style={[Typography.body, directionalText, styles.subtitle]}>
            {t.auth.chooseWorkspaceSubtitle}
          </Text>

          <View style={styles.actions}>
            {availableRoles.includes('customer') ? (
              <AppButton
                testID="workspace-select-customer"
                variant={availableRoles[0] === 'customer' ? 'primary' : 'secondary'}
                label={t.auth.continueAsCustomer}
                loading={selectingRole === 'customer'}
                disabled={isBusy}
                haptic="medium"
                onPress={() => void handleSelectRole('customer')}
              />
            ) : null}

            {availableRoles.includes('marketer') ? (
              <AppButton
                testID="workspace-select-marketer"
                variant={availableRoles[0] === 'marketer' ? 'primary' : 'secondary'}
                label={t.auth.continueAsMarketer}
                loading={selectingRole === 'marketer'}
                disabled={isBusy}
                haptic="medium"
                onPress={() => void handleSelectRole('marketer')}
              />
            ) : null}

            {availableRoles.includes('merchant') ? (
              <AppButton
                testID="workspace-select-merchant"
                variant={availableRoles[0] === 'merchant' ? 'primary' : 'secondary'}
                label={t.auth.continueAsMerchant}
                loading={selectingRole === 'merchant'}
                disabled={isBusy}
                haptic="medium"
                onPress={() => void handleSelectRole('merchant')}
              />
            ) : null}
          </View>
        </Animated.View>

        <AppButton
          testID="workspace-select-signout"
          variant="danger"
          label={t.profile.signOut}
          loadingLabel={t.profile.signingOut}
          loading={isSigningOut}
          disabled={isBusy}
          onPress={handleSignOut}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.gutter,
    paddingVertical: Spacing.section,
    gap: Spacing.section,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.compact + 4,
  },
  brandMeta: {
    flex: 1,
    gap: Spacing.xs,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.gutter + 4,
    gap: Spacing.gutter,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.compact,
  },
  subtitle: {
    color: Colors.muted,
  },
  actions: {
    gap: Spacing.compact + 4,
    paddingTop: Spacing.xs,
  },
});
