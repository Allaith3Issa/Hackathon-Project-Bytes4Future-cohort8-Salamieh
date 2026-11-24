import { useIsFocused } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, BalanceCard, SkeletonBlock, StatusBadge } from '@/components/ui';
import { useLocale } from '@/core/i18n';
import { useAndroidBack } from '@/core/navigation';
import { formatSyp, getDirectionalTextStyle, isolateLtr } from '@/core/rtl';
import {
  BorderWidth,
  Colors,
  FontFamily,
  Radii,
  Spacing,
  Typography,
} from '@/core/theme';
import { useCustomerDashboard } from '@/features/customer/dashboard';

interface MilestoneProgressRowProps {
  testID: string;
  label: string;
  currentValue: number;
  requiredValue: number;
  valueLabel: string;
  subtitleLabel: string;
  completedBadgeLabel: string;
  reducedMotion: boolean;
}

function resolveVisualFillRatio(currentValue: number, requiredValue: number): number {
  if (requiredValue <= 0) {
    return currentValue > 0 ? 1 : 0;
  }
  return Math.min(1, Math.max(0, currentValue / requiredValue));
}

function MilestoneProgressRow({
  testID,
  label,
  currentValue,
  requiredValue,
  valueLabel,
  subtitleLabel,
  completedBadgeLabel,
  reducedMotion,
}: MilestoneProgressRowProps) {
  const { locale } = useLocale();
  const directionalText = getDirectionalTextStyle(locale);
  const ratio = resolveVisualFillRatio(currentValue, requiredValue);
  const isCompleted = requiredValue > 0 && currentValue >= requiredValue;

  const progress = useSharedValue(ratio);

  useEffect(() => {
    progress.value = reducedMotion ? ratio : withTiming(ratio, { duration: 280 });
  }, [progress, ratio, reducedMotion]);

  const animatedBarStyle = useAnimatedStyle(() => {
    const pct = Math.round(progress.value * 100);
    return {
      width: `${pct}%`,
    };
  });

  return (
    <View testID={testID} style={styles.milestoneBlock}>
      <View style={styles.milestoneHeaderRow}>
        <Text style={[Typography.label, directionalText, styles.milestoneLabel]}>
          {label}
        </Text>
        {isCompleted ? (
          <StatusBadge label={completedBadgeLabel} tone="success" showDot />
        ) : null}
      </View>

      <Text
        style={[
          Typography.section,
          directionalText,
          styles.tabularNum,
          styles.milestoneValueText,
        ]}
      >
        {valueLabel}
      </Text>

      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`${label}: ${valueLabel}`}
        accessibilityValue={{
          min: 0,
          max: requiredValue > 0 ? requiredValue : 1,
          now: currentValue,
        }}
        style={styles.progressTrack}
      >
        <Animated.View
          style={[
            styles.progressFill,
            isCompleted ? styles.progressFillCompleted : null,
            animatedBarStyle,
          ]}
        />
      </View>

      <Text style={[Typography.caption, directionalText, styles.mutedText]}>
        {subtitleLabel}
      </Text>
    </View>
  );
}

export default function CustomerCashbackScreen() {
  const { locale, t } = useLocale();
  const isFocused = useIsFocused();
  const reducedMotion = Boolean(useReducedMotion());
  const directionalText = getDirectionalTextStyle(locale);

  const { dashboard, isLoading, isRefreshing, errorMessage, refresh } =
    useCustomerDashboard();

  useAndroidBack({
    enabled: isFocused,
    isRootTab: true,
  });

  const handleRefresh = useCallback(() => {
    void refresh(true);
  }, [refresh]);

  const showSkeleton = isLoading && !dashboard;
  const hasFatalError = Boolean(errorMessage && !dashboard);

  const formattedNumber = useCallback(
    (value: number) =>
      new Intl.NumberFormat(locale === 'ar' ? 'ar-SY' : 'en-US').format(value),
    [locale],
  );

  const purchaseProgressLabel = dashboard
    ? `${isolateLtr(formattedNumber(dashboard.milestonePurchaseCount))} / ${isolateLtr(formattedNumber(dashboard.milestonePurchasesRequired))}`
    : '';

  const spendProgressLabel = dashboard
    ? `${formatSyp(dashboard.milestoneSpendSyp, locale)} / ${formatSyp(dashboard.milestoneSpendRequiredSyp, locale)}`
    : '';

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
        <View style={styles.titleRow}>
          <Text style={[Typography.display, directionalText, styles.titleText]}>
            {t.customer.cashback.screenTitle}
          </Text>
          <StatusBadge label={t.profile.roleCustomer} tone="mauve" />
        </View>

        {hasFatalError ? (
          <View style={styles.errorCard} accessibilityLiveRegion="polite">
            <Text style={[Typography.section, directionalText, styles.errorTitle]}>
              {t.customer.cashback.loadError}
            </Text>
            <Text style={[Typography.body, directionalText, styles.mutedText]}>
              {errorMessage}
            </Text>
            <AppButton
              testID="customer-cashback-retry-button"
              variant="primary"
              label={t.common.retry}
              loading={isRefreshing}
              onPress={handleRefresh}
            />
          </View>
        ) : (
          <>
            {errorMessage && dashboard ? (
              <View style={styles.inlineErrorBanner} accessibilityLiveRegion="polite">
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
              testID="customer-cashback-balance-card"
              variant="primary"
              label={t.customer.cashback.availableCashbackLabel}
              amountSyp={dashboard?.availableCashbackSyp ?? 0}
              hint={t.customer.cashback.availableCashbackHint}
              loading={showSkeleton}
              action={
                <View style={styles.darkCardMetrics}>
                  <View style={styles.darkCardDivider} />
                  <View style={styles.darkMetricsRow}>
                    <View style={styles.darkMetricCell}>
                      <Text
                        style={[
                          Typography.caption,
                          directionalText,
                          styles.darkMetricLabel,
                        ]}
                      >
                        {t.customer.cashback.lockedCashbackLabel}
                      </Text>
                      {showSkeleton ? (
                        <SkeletonBlock
                          width="78%"
                          height={22}
                          borderRadius={Radii.control}
                          tone="ink"
                        />
                      ) : (
                        <Text
                          testID="customer-cashback-locked-value"
                          style={[
                            Typography.label,
                            directionalText,
                            styles.tabularNum,
                            styles.darkMetricValue,
                          ]}
                        >
                          {formatSyp(dashboard?.lockedCashbackSyp ?? 0, locale)}
                        </Text>
                      )}
                    </View>

                    <View style={styles.darkMetricVerticalDivider} />

                    <View style={styles.darkMetricCell}>
                      <Text
                        style={[
                          Typography.caption,
                          directionalText,
                          styles.darkMetricLabel,
                        ]}
                      >
                        {t.customer.cashback.totalUnlockedLabel}
                      </Text>
                      {showSkeleton ? (
                        <SkeletonBlock
                          width="78%"
                          height={22}
                          borderRadius={Radii.control}
                          tone="ink"
                        />
                      ) : (
                        <Text
                          testID="customer-cashback-unlocked-value"
                          style={[
                            Typography.label,
                            directionalText,
                            styles.tabularNum,
                            styles.darkMetricValue,
                          ]}
                        >
                          {formatSyp(dashboard?.totalCashbackUnlockedSyp ?? 0, locale)}
                        </Text>
                      )}
                    </View>
                  </View>

                  <Text
                    style={[Typography.caption, directionalText, styles.darkLockedHint]}
                  >
                    {t.customer.cashback.lockedCashbackHint}
                  </Text>
                </View>
              }
            />

            <Animated.View
              entering={reducedMotion ? undefined : FadeIn.duration(220)}
              style={styles.sectionCard}
            >
              <View style={styles.sectionHeader}>
                <Text style={[Typography.section, directionalText]}>
                  {t.customer.cashback.milestonesTitle}
                </Text>
                <Text style={[Typography.caption, directionalText, styles.mutedText]}>
                  {t.customer.cashback.milestonesSubtitle}
                </Text>
              </View>

              {showSkeleton || !dashboard ? (
                <View style={styles.skeletonStack}>
                  <SkeletonBlock width="45%" height={18} />
                  <SkeletonBlock width="60%" height={24} />
                  <SkeletonBlock width="100%" height={10} borderRadius={999} />
                  <SkeletonBlock width="48%" height={18} />
                  <SkeletonBlock width="68%" height={24} />
                  <SkeletonBlock width="100%" height={10} borderRadius={999} />
                  <SkeletonBlock width="100%" height={54} borderRadius={Radii.control} />
                </View>
              ) : (
                <>
                  <MilestoneProgressRow
                    testID="customer-milestone-purchases"
                    label={t.customer.cashback.purchaseMilestoneLabel}
                    currentValue={dashboard.milestonePurchaseCount}
                    requiredValue={dashboard.milestonePurchasesRequired}
                    valueLabel={purchaseProgressLabel}
                    subtitleLabel={t.customer.cashback.milestoneRemainingPurchases}
                    completedBadgeLabel={t.customer.cashback.milestoneCompletedBadge}
                    reducedMotion={reducedMotion}
                  />

                  <View style={styles.divider} />

                  <MilestoneProgressRow
                    testID="customer-milestone-spend"
                    label={t.customer.cashback.spendMilestoneLabel}
                    currentValue={dashboard.milestoneSpendSyp}
                    requiredValue={dashboard.milestoneSpendRequiredSyp}
                    valueLabel={spendProgressLabel}
                    subtitleLabel={t.customer.cashback.milestoneRemainingSpend}
                    completedBadgeLabel={t.customer.cashback.milestoneCompletedBadge}
                    reducedMotion={reducedMotion}
                  />

                  <View style={styles.verifiedPurchasesBox}>
                    <Text style={[Typography.label, directionalText, styles.detailText]}>
                      {t.customer.cashback.verifiedPurchasesLabel}
                    </Text>
                    <Text
                      testID="customer-verified-purchase-count"
                      style={[
                        Typography.section,
                        styles.tabularNum,
                        styles.detailText,
                        styles.verifiedPurchasesValue,
                      ]}
                    >
                      {formattedNumber(dashboard.verifiedPurchaseCount)}
                    </Text>
                  </View>
                </>
              )}
            </Animated.View>

            <View style={styles.infoNoteCard}>
              <Text style={[Typography.caption, directionalText, styles.infoNoteText]}>
                {t.customer.cashback.cashbackInfoNote}
              </Text>
            </View>
          </>
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
    paddingBottom: Spacing.section * 2,
    gap: Spacing.gutter,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.compact,
  },
  titleText: {
    flexShrink: 1,
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
  darkCardMetrics: {
    gap: Spacing.compact + 2,
  },
  darkCardDivider: {
    height: BorderWidth.hairline,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  darkMetricsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.compact,
  },
  darkMetricCell: {
    flex: 1,
    gap: Spacing.xs,
  },
  darkMetricVerticalDivider: {
    width: BorderWidth.hairline,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  darkMetricLabel: {
    color: Colors.mauveTint,
  },
  darkMetricValue: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    lineHeight: 24,
    color: Colors.onInk,
  },
  darkLockedHint: {
    color: 'rgba(255, 255, 255, 0.78)',
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
    gap: Spacing.xs,
  },
  skeletonStack: {
    gap: Spacing.compact,
  },
  milestoneBlock: {
    gap: Spacing.xs + 2,
  },
  milestoneHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.compact,
  },
  milestoneLabel: {
    flexShrink: 1,
  },
  milestoneValueText: {
    color: Colors.ink,
  },
  progressTrack: {
    width: '100%',
    height: 10,
    borderRadius: 999,
    backgroundColor: Colors.mauveTint,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: Colors.action,
  },
  progressFillCompleted: {
    backgroundColor: Colors.success,
  },
  divider: {
    height: BorderWidth.hairline,
    backgroundColor: Colors.rule,
  },
  verifiedPurchasesBox: {
    backgroundColor: Colors.canvas,
    borderRadius: Radii.control,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    paddingHorizontal: Spacing.compact + 4,
    paddingVertical: Spacing.compact + 2,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.compact,
  },
  detailText: {
    flexShrink: 1,
  },
  verifiedPurchasesValue: {
    color: Colors.action,
  },
  infoNoteCard: {
    backgroundColor: Colors.infoBg,
    borderRadius: Radii.control,
    borderWidth: BorderWidth.hairline,
    borderColor: 'rgba(83, 71, 103, 0.22)',
    padding: Spacing.gutter,
  },
  infoNoteText: {
    color: Colors.info,
  },
  tabularNum: {
    fontVariant: ['tabular-nums'],
  },
});
