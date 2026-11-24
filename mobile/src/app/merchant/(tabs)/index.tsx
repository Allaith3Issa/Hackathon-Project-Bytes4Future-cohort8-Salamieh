import { useIsFocused, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useCallback } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AppButton,
  BalanceCard,
  SkeletonBlock,
  StatusBadge,
} from '@/components/ui';
import type { StatusBadgeTone } from '@/components/ui';
import { useAuth } from '@/core/auth';
import type { VerificationStatus } from '@/core/auth';
import { useLocale } from '@/core/i18n';
import { useAndroidBack } from '@/core/navigation';
import { formatPercent, formatSyp, getDirectionalTextStyle } from '@/core/rtl';
import { BorderWidth, Colors, FontFamily, Radii, Spacing, Typography } from '@/core/theme';
import { useMerchantDashboard } from '@/features/merchant/dashboard';

function getVerificationBadgeMeta(
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

export default function MerchantDashboardScreen() {
  const { locale, t } = useLocale();
  const { user } = useAuth();
  const router = useRouter();
  const isFocused = useIsFocused();

  const { dashboard, isLoading, isRefreshing, errorMessage, refresh } =
    useMerchantDashboard();

  useAndroidBack({
    enabled: isFocused,
    isRootTab: true,
  });

  const directionalText = getDirectionalTextStyle(locale);

  const handleRefresh = useCallback(() => {
    void refresh(true);
  }, [refresh]);

  const handleCreateCampaign = useCallback(() => {
    router.push('/merchant/campaigns/new' as Href);
  }, [router]);

  const handleOpenScanner = useCallback(() => {
    router.navigate('/merchant/scanner' as Href);
  }, [router]);

  const verificationStatus: VerificationStatus =
    dashboard?.verificationStatus ?? user?.merchant?.verificationStatus ?? 'pending';
  const verificationBadge = getVerificationBadgeMeta(
    verificationStatus,
    t.merchant.verification,
  );
  const shopName = user?.merchant?.name;
  const isVerified = verificationStatus === 'verified';

  const statItems = dashboard
    ? [
        {
          key: 'activeCampaigns',
          label: t.merchant.dashboard.activeCampaignsLabel,
          value: String(dashboard.activeCampaignsCount),
        },
        {
          key: 'clicks',
          label: t.merchant.dashboard.clicksLabel,
          value: String(dashboard.stats.clicks),
        },
        {
          key: 'salesCount',
          label: t.merchant.dashboard.salesCountLabel,
          value: String(dashboard.stats.salesCount),
        },
        {
          key: 'itemsSold',
          label: t.merchant.dashboard.itemsSoldLabel,
          value: String(dashboard.stats.itemsSold),
        },
        {
          key: 'grossCashSales',
          label: t.merchant.dashboard.grossSalesLabel,
          value: formatSyp(dashboard.stats.grossCashSalesSyp, locale),
        },
        {
          key: 'commissionPaid',
          label: t.merchant.dashboard.commissionsPaidLabel,
          value: formatSyp(dashboard.stats.commissionPaidSyp, locale),
        },
        {
          key: 'platformFees',
          label: t.merchant.dashboard.platformFeesLabel,
          value: formatSyp(dashboard.stats.platformFeesPaidSyp, locale),
        },
        {
          key: 'conversionRate',
          label: t.merchant.dashboard.conversionRateLabel,
          value: formatPercent(dashboard.stats.conversionRatePercent, locale),
        },
      ]
    : [];

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
        <View style={styles.headerBlock}>
          <View style={styles.titleRow}>
            <View style={styles.titleStack}>
              <Text style={[Typography.display, directionalText]}>
                {t.merchant.dashboard.screenTitle}
              </Text>
              {shopName ? (
                <Text style={[Typography.caption, directionalText, styles.shopSubtitle]}>
                  {shopName}
                </Text>
              ) : null}
            </View>
            <StatusBadge
              label={verificationBadge.label}
              tone={verificationBadge.tone}
              showDot
            />
          </View>

          {!isVerified ? (
            <View
              testID="merchant-unverified-banner"
              style={
                verificationStatus === 'rejected'
                  ? styles.rejectedBanner
                  : styles.pendingBanner
              }
            >
              <Text
                style={[
                  Typography.label,
                  directionalText,
                  verificationStatus === 'rejected'
                    ? styles.rejectedBannerText
                    : styles.pendingBannerText,
                ]}
              >
                {t.merchant.verification.unverifiedBanner}
              </Text>
            </View>
          ) : null}
        </View>

        {isLoading && !dashboard ? (
          <View style={styles.sectionStack}>
            <BalanceCard
              label={t.merchant.dashboard.availableBalance}
              amountSyp={0}
              variant="primary"
              loading
            />
            <BalanceCard
              label={t.merchant.dashboard.lockedReserves}
              amountSyp={0}
              variant="secondary"
              loading
            />
            <View style={styles.surfaceCard}>
              <SkeletonBlock width="45%" height={20} />
              <View style={styles.skeletonGrid}>
                <SkeletonBlock width="48%" height={72} borderRadius={Radii.control} />
                <SkeletonBlock width="48%" height={72} borderRadius={Radii.control} />
                <SkeletonBlock width="48%" height={72} borderRadius={Radii.control} />
                <SkeletonBlock width="48%" height={72} borderRadius={Radii.control} />
              </View>
            </View>
          </View>
        ) : errorMessage && !dashboard ? (
          <View style={styles.errorCard}>
            <Text style={[Typography.section, directionalText, styles.errorTitle]}>
              {t.merchant.dashboard.loadError}
            </Text>
            <Text style={[Typography.body, directionalText, styles.mutedText]}>
              {errorMessage}
            </Text>
            <AppButton
              testID="merchant-dashboard-retry-button"
              variant="primary"
              label={t.common.retry}
              loading={isRefreshing}
              onPress={handleRefresh}
            />
          </View>
        ) : (
          <View style={styles.sectionStack}>
            {errorMessage ? (
              <View style={styles.inlineErrorBanner}>
                <Text style={[Typography.label, directionalText, styles.errorTitle]}>
                  {errorMessage}
                </Text>
                <AppButton
                  variant="secondary"
                  fullWidth={false}
                  label={t.common.retry}
                  loading={isRefreshing}
                  onPress={handleRefresh}
                />
              </View>
            ) : null}

            <BalanceCard
              testID="merchant-available-balance-card"
              label={t.merchant.dashboard.availableBalance}
              amountSyp={dashboard?.wallet.availableBalanceSyp ?? 0}
              hint={t.merchant.dashboard.availableBalanceHint}
              variant="primary"
              badge={{ label: t.profile.roleMerchant, tone: 'mauve' }}
            />

            <BalanceCard
              testID="merchant-locked-reserves-card"
              label={t.merchant.dashboard.lockedReserves}
              amountSyp={dashboard?.wallet.totalLockedReservesSyp ?? 0}
              hint={t.merchant.dashboard.lockedReservesHint}
              variant="secondary"
            />

            <View style={styles.surfaceCard}>
              <Text style={[Typography.section, directionalText]}>
                {t.merchant.dashboard.quickActionsTitle}
              </Text>
              <View style={styles.quickActionsRow}>
                <View style={styles.quickActionCol}>
                  <AppButton
                    testID="merchant-quick-create-campaign"
                    variant="primary"
                    label={t.merchant.dashboard.createCampaignAction}
                    onPress={handleCreateCampaign}
                  />
                </View>
                <View style={styles.quickActionCol}>
                  <AppButton
                    testID="merchant-quick-scan-qr"
                    variant="secondary"
                    label={t.merchant.dashboard.scanQrAction}
                    onPress={handleOpenScanner}
                  />
                </View>
              </View>
            </View>

            {dashboard ? (
              <View style={styles.surfaceCard}>
                <Text style={[Typography.section, directionalText]}>
                  {t.merchant.dashboard.statsSectionTitle}
                </Text>
                <View style={styles.statsGrid}>
                  {statItems.map((item) => (
                    <View key={item.key} style={styles.statTile}>
                      <Text style={[Typography.caption, directionalText]}>
                        {item.label}
                      </Text>
                      <Text style={[Typography.section, directionalText, styles.statValue]}>
                        {item.value}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {dashboard?.topCampaign ? (
              <View testID="merchant-top-campaign-card" style={styles.topCampaignCard}>
                <View style={styles.topCampaignHeader}>
                  <Text style={[Typography.caption, directionalText, styles.topCampaignEyebrow]}>
                    {t.merchant.dashboard.topCampaignTitle}
                  </Text>
                </View>

                <Text style={[Typography.section, directionalText]}>
                  {dashboard.topCampaign.productName}
                </Text>

                <View style={styles.topCampaignMetricsRow}>
                  <View style={styles.topMetricBlock}>
                    <Text style={[Typography.caption, directionalText]}>
                      {t.merchant.dashboard.topCampaignSalesLabel}
                    </Text>
                    <Text style={[Typography.label, directionalText]}>
                      {dashboard.topCampaign.salesCount}
                    </Text>
                  </View>

                  <View style={styles.topMetricBlock}>
                    <Text style={[Typography.caption, directionalText]}>
                      {t.merchant.dashboard.topCampaignRevenueLabel}
                    </Text>
                    <Text style={[Typography.label, directionalText, styles.topRevenueValue]}>
                      {formatSyp(dashboard.topCampaign.grossCashSalesSyp, locale)}
                    </Text>
                  </View>
                </View>
              </View>
            ) : null}
          </View>
        )}
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
  headerBlock: {
    gap: Spacing.compact + 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.compact,
  },
  titleStack: {
    flexShrink: 1,
    gap: Spacing.xs,
  },
  shopSubtitle: {
    color: Colors.muted,
    fontFamily: FontFamily.semiBold,
  },
  pendingBanner: {
    backgroundColor: Colors.infoBg,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.gutter,
  },
  pendingBannerText: {
    color: Colors.info,
  },
  rejectedBanner: {
    backgroundColor: Colors.dangerBg,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: 'rgba(152, 45, 61, 0.25)',
    padding: Spacing.gutter,
  },
  rejectedBannerText: {
    color: Colors.danger,
  },
  sectionStack: {
    gap: Spacing.gutter,
  },
  surfaceCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.gutter,
    gap: Spacing.gutter,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: Spacing.compact + 4,
  },
  quickActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.compact + 4,
  },
  quickActionCol: {
    flex: 1,
    minWidth: 140,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.compact + 4,
  },
  statTile: {
    width: '47.5%',
    flexGrow: 1,
    backgroundColor: Colors.canvas,
    borderRadius: Radii.control,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.compact + 4,
    gap: Spacing.xs,
  },
  statValue: {
    color: Colors.ink,
    fontFamily: FontFamily.bold,
  },
  topCampaignCard: {
    backgroundColor: Colors.mauveTint,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.gutter,
    gap: Spacing.compact + 4,
  },
  topCampaignHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.compact,
  },
  topCampaignEyebrow: {
    color: Colors.muted,
    fontFamily: FontFamily.semiBold,
  },
  topCampaignMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.gutter,
    paddingTop: Spacing.xs,
    borderTopWidth: BorderWidth.hairline,
    borderTopColor: Colors.rule,
  },
  topMetricBlock: {
    gap: Spacing.xs,
  },
  topRevenueValue: {
    color: Colors.action,
  },
  errorCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: 'rgba(152, 45, 61, 0.25)',
    padding: Spacing.section,
    gap: Spacing.gutter,
  },
  errorTitle: {
    color: Colors.danger,
  },
  inlineErrorBanner: {
    backgroundColor: Colors.dangerBg,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: 'rgba(152, 45, 61, 0.25)',
    padding: Spacing.gutter,
    gap: Spacing.compact,
  },
  mutedText: {
    color: Colors.muted,
  },
});
