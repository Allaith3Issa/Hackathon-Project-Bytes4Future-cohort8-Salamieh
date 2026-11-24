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
import { useAuth } from '@/core/auth';
import type { MobileWorkspaceRole } from '@/core/auth';
import { useLocale } from '@/core/i18n';
import type { AppLocale } from '@/core/i18n';
import { useAndroidBack } from '@/core/navigation';
import { formatSyp, getDirectionalTextStyle, LtrTextStyle } from '@/core/rtl';
import {
  BorderWidth,
  Colors,
  FontFamily,
  Radii,
  Spacing,
  TouchTarget,
  Typography,
} from '@/core/theme';
import { useCustomerDashboard } from '@/features/customer/dashboard';
import {
  useLanguageSwitcher,
  useProfileAccount,
  useSignOut,
} from '@/features/profile';

type CustomerSwitchableRole = Exclude<MobileWorkspaceRole, 'customer'>;

export default function CustomerProfileScreen() {
  const { t } = useLocale();
  const isFocused = useIsFocused();
  const { availableRoles, switchWorkspaceRole } = useAuth();
  const [switchingToRole, setSwitchingToRole] =
    useState<CustomerSwitchableRole | null>(null);

  const {
    account,
    isLoading: isAccountLoading,
    isRefreshing: isAccountRefreshing,
    errorMessage: accountErrorMessage,
    refresh: refreshAccount,
  } = useProfileAccount();
  const {
    dashboard,
    isLoading: isDashboardLoading,
    isRefreshing: isDashboardRefreshing,
    errorMessage: dashboardErrorMessage,
    refresh: refreshDashboard,
  } = useCustomerDashboard();
  const { locale, switchLanguage } = useLanguageSwitcher();
  const { isSigningOut, signOut } = useSignOut();

  const isSwitchingRole = switchingToRole !== null;
  const switchableRoles = availableRoles.filter(
    (role): role is CustomerSwitchableRole => role !== 'customer',
  );

  useAndroidBack({
    enabled: isFocused,
    isBusy: isSigningOut || isSwitchingRole,
    isRootTab: true,
  });

  const directionalText = getDirectionalTextStyle(locale);
  const isRefreshing = isAccountRefreshing || isDashboardRefreshing;
  const errorMessages = Array.from(
    new Set(
      [accountErrorMessage, dashboardErrorMessage].filter(
        (msg): msg is string => Boolean(msg),
      ),
    ),
  );

  const handleRefresh = useCallback(() => {
    void Promise.all([refreshAccount(true), refreshDashboard(true)]);
  }, [refreshAccount, refreshDashboard]);

  const handleSelectLocale = useCallback(
    (nextLocale: AppLocale) => {
      void switchLanguage(nextLocale);
    },
    [switchLanguage],
  );

  const handleSwitchToRole = useCallback(
    async (targetRole: CustomerSwitchableRole) => {
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

  const formattedCount = useCallback(
    (value: number) =>
      new Intl.NumberFormat(locale === 'ar' ? 'ar-SY' : 'en-US').format(value),
    [locale],
  );

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

        {errorMessages.length > 0 ? (
          <View
            testID="customer-profile-error-banner"
            style={styles.inlineErrorBanner}
            accessibilityLiveRegion="polite"
          >
            {errorMessages.map((msg) => (
              <Text
                key={msg}
                style={[Typography.label, directionalText, styles.errorTitle]}
              >
                {msg}
              </Text>
            ))}
            <AppButton
              testID="customer-profile-retry-button"
              variant="secondary"
              fullWidth={false}
              label={t.common.retry}
              loading={isRefreshing}
              disabled={isRefreshing}
              onPress={handleRefresh}
            />
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={[Typography.section, directionalText]}>
              {t.profile.accountSection}
            </Text>
            <StatusBadge label={t.profile.roleCustomer} tone="mauve" showDot />
          </View>

          {isAccountLoading ? (
            <View style={styles.skeletonStack}>
              <SkeletonBlock width="65%" height={20} />
              <SkeletonBlock width="45%" height={18} />
              <SkeletonBlock width="52%" height={18} />
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
                <Text
                  selectable
                  style={[Typography.body, LtrTextStyle, styles.phoneValue]}
                >
                  {account.phone}
                </Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.infoRow}>
                <Text style={[Typography.caption, directionalText]}>
                  {t.profile.roleLabel}
                </Text>
                <Text style={[Typography.label, directionalText]}>
                  {t.profile.roleCustomer}
                </Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.infoRow}>
                <Text style={[Typography.caption, directionalText]}>
                  {t.customer.profile.verifiedPurchasesLabel}
                </Text>
                {isDashboardLoading && !dashboard ? (
                  <SkeletonBlock width={64} height={20} />
                ) : (
                  <Text
                    testID="customer-profile-verified-purchases"
                    style={[Typography.label, styles.tabularNum, styles.infoValue]}
                  >
                    {dashboard ? formattedCount(dashboard.verifiedPurchaseCount) : '—'}
                  </Text>
                )}
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.sectionCard}>
          <Text style={[Typography.section, directionalText]}>
            {t.customer.profile.summaryTitle}
          </Text>

          {isDashboardLoading && !dashboard ? (
            <View style={styles.skeletonStack}>
              <SkeletonBlock width="62%" height={20} />
              <SkeletonBlock width="54%" height={20} />
            </View>
          ) : (
            <View style={styles.summaryRows}>
              <View style={styles.summaryRow}>
                <Text style={[Typography.caption, directionalText, styles.detailText]}>
                  {t.customer.profile.availableCashbackLabel}
                </Text>
                <Text
                  style={[
                    Typography.label,
                    styles.tabularNum,
                    styles.detailText,
                    styles.availableValue,
                  ]}
                >
                  {dashboard ? formatSyp(dashboard.availableCashbackSyp, locale) : '—'}
                </Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.summaryRow}>
                <Text style={[Typography.caption, directionalText, styles.detailText]}>
                  {t.customer.profile.lockedCashbackLabel}
                </Text>
                <Text
                  style={[
                    Typography.label,
                    styles.tabularNum,
                    styles.detailText,
                    styles.infoValue,
                  ]}
                >
                  {dashboard ? formatSyp(dashboard.lockedCashbackSyp, locale) : '—'}
                </Text>
              </View>
            </View>
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
                targetRole === 'marketer'
                  ? t.profile.switchToMarketer
                  : t.profile.switchToMerchant;

              return (
                <AppButton
                  key={targetRole}
                  testID={`customer-switch-${targetRole}-button`}
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
              testID="profile-lang-ar"
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
              testID="profile-lang-en"
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
            testID="profile-signout-button"
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
    paddingBottom: Spacing.section * 2,
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
  inlineErrorBanner: {
    backgroundColor: Colors.dangerBg,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: 'rgba(152, 45, 61, 0.25)',
    padding: Spacing.gutter,
    gap: Spacing.compact,
  },
  errorTitle: {
    color: Colors.danger,
  },
  summaryRows: {
    gap: Spacing.compact + 4,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.compact,
  },
  detailText: {
    flexShrink: 1,
  },
  availableValue: {
    fontFamily: FontFamily.bold,
    color: Colors.success,
  },
  divider: {
    height: BorderWidth.hairline,
    backgroundColor: Colors.rule,
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
  tabularNum: {
    fontVariant: ['tabular-nums'],
  },
});
