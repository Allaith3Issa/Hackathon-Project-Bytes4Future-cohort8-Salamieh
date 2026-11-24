import { useIsFocused } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, SkeletonBlock, StatusBadge } from '@/components/ui';
import type { StatusBadgeTone } from '@/components/ui';
import { useAuth } from '@/core/auth';
import type { MobileWorkspaceRole, VerificationStatus } from '@/core/auth';
import { useLocale } from '@/core/i18n';
import type { AppLocale } from '@/core/i18n';
import { useAndroidBack } from '@/core/navigation';
import { getDirectionalTextStyle, LtrTextStyle } from '@/core/rtl';
import {
  BorderWidth,
  Colors,
  FontFamily,
  Radii,
  Spacing,
  TouchTarget,
  Typography,
} from '@/core/theme';
import {
  useLanguageSwitcher,
  useProfileAccount,
  useSignOut,
} from '@/features/profile';

function getVerificationBadge(
  status: VerificationStatus,
  labels: { pending: string; verified: string; rejected: string },
): { label: string; tone: StatusBadgeTone } {
  if (status === 'verified') {
    return { label: labels.verified, tone: 'success' };
  }
  if (status === 'rejected') {
    return { label: labels.rejected, tone: 'danger' };
  }
  return { label: labels.pending, tone: 'info' };
}

type MerchantSwitchableRole = Exclude<MobileWorkspaceRole, 'merchant'>;

export default function MerchantProfileScreen() {
  const { t } = useLocale();
  const isFocused = useIsFocused();
  const { availableRoles, switchWorkspaceRole } = useAuth();
  const [switchingToRole, setSwitchingToRole] =
    useState<MerchantSwitchableRole | null>(null);

  const { account, isLoading, isRefreshing, refresh } = useProfileAccount();
  const { locale, switchLanguage } = useLanguageSwitcher();
  const { isSigningOut, signOut } = useSignOut();

  const isSwitchingRole = switchingToRole !== null;
  const switchableRoles = availableRoles.filter(
    (role): role is MerchantSwitchableRole => role !== 'merchant',
  );

  useAndroidBack({
    enabled: isFocused,
    isBusy: isSigningOut || isSwitchingRole,
    isRootTab: true,
  });

  const directionalText = getDirectionalTextStyle(locale);

  const handleRefresh = useCallback(() => {
    void refresh(true);
  }, [refresh]);

  const handleSelectLocale = useCallback(
    (nextLocale: AppLocale) => {
      void switchLanguage(nextLocale);
    },
    [switchLanguage],
  );

  const handleSwitchToRole = useCallback(
    async (targetRole: MerchantSwitchableRole) => {
      if (
        !switchableRoles.includes(targetRole) ||
        switchingToRole !== null ||
        isSigningOut
      ) {
        return;
      }
      setSwitchingToRole(targetRole);
      try {
        await switchWorkspaceRole(targetRole);
      } finally {
        setSwitchingToRole(null);
      }
    },
    [isSigningOut, switchWorkspaceRole, switchableRoles, switchingToRole],
  );

  const handleSignOut = useCallback(() => {
    void signOut();
  }, [signOut]);

  const merchantInfo = account?.merchant ?? null;
  const verificationBadge = merchantInfo
    ? getVerificationBadge(merchantInfo.verificationStatus, t.merchant.verification)
    : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.action}
            colors={[Colors.action]}
          />
        }
      >
        <Text style={[Typography.display, directionalText]}>
          {t.profile.screenTitle}
        </Text>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={[Typography.section, directionalText]}>
              {t.profile.accountSection}
            </Text>
            <StatusBadge label={t.profile.roleMerchant} tone="mauve" showDot />
          </View>

          {isLoading && !account ? (
            <View style={styles.skeletonStack}>
              <SkeletonBlock width="65%" height={20} />
              <SkeletonBlock width="45%" height={18} />
            </View>
          ) : account ? (
            <View style={styles.infoList}>
              <View style={styles.infoRow}>
                <Text style={[Typography.caption, directionalText]}>
                  {t.profile.nameLabel}
                </Text>
                <Text style={[Typography.body, directionalText, styles.infoValue]}>
                  {account.name}
                </Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.infoRow}>
                <Text style={[Typography.caption, directionalText]}>
                  {t.profile.phoneLabel}
                </Text>
                <Text selectable style={[Typography.body, LtrTextStyle, styles.phoneValue]}>
                  {account.phone}
                </Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.infoRow}>
                <Text style={[Typography.caption, directionalText]}>
                  {t.profile.roleLabel}
                </Text>
                <Text style={[Typography.label, directionalText]}>
                  {t.profile.roleMerchant}
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={[Typography.section, directionalText]}>
              {t.merchant.profile.shopSection}
            </Text>
            {verificationBadge ? (
              <StatusBadge
                label={verificationBadge.label}
                tone={verificationBadge.tone}
                showDot
              />
            ) : null}
          </View>

          {isLoading && !account ? (
            <View style={styles.skeletonStack}>
              <SkeletonBlock width="70%" height={20} />
              <SkeletonBlock width="90%" height={36} />
            </View>
          ) : merchantInfo ? (
            <View style={styles.infoList}>
              <View style={styles.infoRow}>
                <Text style={[Typography.caption, directionalText]}>
                  {t.merchant.profile.shopNameLabel}
                </Text>
                <Text style={[Typography.body, directionalText, styles.infoValue]}>
                  {merchantInfo.name}
                </Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.infoRow}>
                <Text style={[Typography.caption, directionalText]}>
                  {t.merchant.profile.shopDetailsLabel}
                </Text>
                <Text style={[Typography.body, directionalText]}>
                  {merchantInfo.details}
                </Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.infoRow}>
                <Text style={[Typography.caption, directionalText]}>
                  {t.merchant.profile.verificationLabel}
                </Text>
                <Text style={[Typography.label, directionalText]}>
                  {verificationBadge?.label ?? t.common.notAvailable}
                </Text>
              </View>

              {merchantInfo.contractReference ? (
                <>
                  <View style={styles.divider} />
                  <View style={styles.infoRow}>
                    <Text style={[Typography.caption, directionalText]}>
                      {t.merchant.profile.contractReferenceLabel}
                    </Text>
                    <Text
                      selectable
                      style={[Typography.body, LtrTextStyle, styles.phoneValue]}
                    >
                      {merchantInfo.contractReference}
                    </Text>
                  </View>
                </>
              ) : null}
            </View>
          ) : (
            <Text style={[Typography.body, directionalText, styles.mutedText]}>
              {t.common.notAvailable}
            </Text>
          )}
        </View>

        {switchableRoles.length > 0 ? (
          <View style={styles.sectionCard}>
            <Text style={[Typography.section, directionalText]}>
              {t.profile.workspaceSection}
            </Text>
            <Text style={[Typography.caption, directionalText]}>
              {t.profile.switchWorkspaceLabel}
            </Text>
            {switchableRoles.map((targetRole) => {
              const label =
                targetRole === 'customer'
                  ? t.profile.switchToCustomer
                  : t.profile.switchToMarketer;

              return (
                <AppButton
                  key={targetRole}
                  testID={`merchant-switch-${targetRole}-button`}
                  variant="secondary"
                  label={label}
                  loading={switchingToRole === targetRole}
                  disabled={isSigningOut || isSwitchingRole}
                  onPress={() => void handleSwitchToRole(targetRole)}
                />
              );
            })}
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <Text style={[Typography.section, directionalText]}>
            {t.profile.settingsSection}
          </Text>

          <View style={styles.languageHeader}>
            <Text style={[Typography.label, directionalText]}>
              {t.profile.languageLabel}
            </Text>
            <Text style={[Typography.caption, directionalText]}>
              {t.profile.languageHint}
            </Text>
          </View>

          <View
            style={styles.languageSwitchTrack}
            accessibilityRole="radiogroup"
            accessibilityLabel={t.profile.languageLabel}
          >
            <Pressable
              testID="merchant-profile-lang-ar"
              onPress={() => handleSelectLocale('ar')}
              accessibilityRole="radio"
              accessibilityState={{ checked: locale === 'ar' }}
              accessibilityLabel={t.profile.languageArabic}
              style={[
                styles.languageOption,
                locale === 'ar' ? styles.languageOptionActive : null,
              ]}
            >
              <Text
                style={[
                  styles.languageOptionText,
                  locale === 'ar' ? styles.languageOptionTextActive : null,
                ]}
              >
                {t.profile.languageArabic}
              </Text>
            </Pressable>

            <Pressable
              testID="merchant-profile-lang-en"
              onPress={() => handleSelectLocale('en')}
              accessibilityRole="radio"
              accessibilityState={{ checked: locale === 'en' }}
              accessibilityLabel={t.profile.languageEnglish}
              style={[
                styles.languageOption,
                locale === 'en' ? styles.languageOptionActive : null,
              ]}
            >
              <Text
                style={[
                  styles.languageOptionText,
                  locale === 'en' ? styles.languageOptionTextActive : null,
                ]}
              >
                {t.profile.languageEnglish}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.signOutSection}>
          <AppButton
            testID="merchant-profile-signout-button"
            variant="danger"
            label={t.profile.signOut}
            loadingLabel={t.profile.signingOut}
            loading={isSigningOut}
            disabled={isSigningOut || isSwitchingRole}
            haptic="medium"
            onPress={handleSignOut}
          />
        </View>
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
    paddingHorizontal: Spacing.gutter,
    paddingTop: Spacing.gutter,
    paddingBottom: Spacing.section,
    gap: Spacing.section,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.gutter,
    gap: Spacing.gutter,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.compact,
  },
  skeletonStack: {
    gap: Spacing.compact,
  },
  infoList: {
    gap: Spacing.compact + 4,
  },
  infoRow: {
    gap: Spacing.xs,
  },
  infoValue: {
    fontFamily: FontFamily.semiBold,
    color: Colors.ink,
  },
  phoneValue: {
    fontFamily: FontFamily.semiBold,
    color: Colors.ink,
  },
  divider: {
    height: BorderWidth.hairline,
    backgroundColor: Colors.rule,
  },
  mutedText: {
    color: Colors.muted,
  },
  languageHeader: {
    gap: Spacing.xs,
  },
  languageSwitchTrack: {
    flexDirection: 'row',
    backgroundColor: Colors.canvas,
    borderRadius: Radii.control,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.controlBorder,
    padding: Spacing.xs,
    gap: Spacing.xs,
  },
  languageOption: {
    flex: 1,
    minHeight: TouchTarget.minHeight,
    minWidth: TouchTarget.minWidth,
    borderRadius: Radii.control - 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.compact,
    paddingVertical: Spacing.compact,
  },
  languageOptionActive: {
    backgroundColor: Colors.action,
  },
  languageOptionText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.ink,
    textAlign: 'center',
  },
  languageOptionTextActive: {
    color: Colors.onInk,
  },
  signOutSection: {
    gap: Spacing.compact + 4,
  },
});
