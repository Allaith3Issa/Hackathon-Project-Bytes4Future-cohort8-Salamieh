import { useIsFocused, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useCallback } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, SkeletonBlock, StatusBadge } from '@/components/ui';
import { useLocale } from '@/core/i18n';
import { useAndroidBack } from '@/core/navigation';
import { formatCampaignDate, formatSyp, getDirectionalTextStyle } from '@/core/rtl';
import {
  BorderWidth,
  Colors,
  FontFamily,
  Radii,
  Spacing,
  TouchTarget,
  Typography,
} from '@/core/theme';
import { useMerchantCampaigns } from '@/features/merchant/campaigns';
import type {
  MerchantCampaign,
  MerchantCampaignStatusFilter,
} from '@/features/merchant/campaigns';

function computeSalesRatio(campaign: MerchantCampaign): {
  ratio: number;
  label: string;
} {
  const { usage } = campaign;
  if (usage.maxItems !== null && usage.maxItems > 0) {
    const clamped = Math.min(1, Math.max(0, usage.itemsSold / usage.maxItems));
    return {
      ratio: clamped,
      label: `${usage.itemsSold} / ${usage.maxItems}`,
    };
  }
  if (usage.maxSalesVolumeSyp !== null && usage.maxSalesVolumeSyp > 0) {
    const clamped = Math.min(
      1,
      Math.max(0, usage.salesVolumeSyp / usage.maxSalesVolumeSyp),
    );
    return {
      ratio: clamped,
      label: `${usage.itemsSold}`,
    };
  }
  return { ratio: 0, label: String(usage.itemsSold) };
}

export default function MerchantCampaignsScreen() {
  const { locale, t } = useLocale();
  const router = useRouter();
  const isFocused = useIsFocused();
  const directionalText = getDirectionalTextStyle(locale);

  const {
    items,
    nextPage,
    statusFilter,
    setStatusFilter,
    hasLoaded,
    isLoading,
    isRefreshing,
    isLoadingMore,
    errorMessage,
    refresh,
    loadMore,
  } = useMerchantCampaigns('all');

  useAndroidBack({
    enabled: isFocused,
    isRootTab: true,
  });

  const handleCreateCampaign = useCallback(() => {
    router.push('/merchant/campaigns/new' as Href);
  }, [router]);

  const handleOpenCampaign = useCallback(
    (campaignId: string) => {
      router.push(`/merchant/campaigns/${campaignId}` as Href);
    },
    [router],
  );

  const handleRefresh = useCallback(() => {
    void refresh();
  }, [refresh]);

  const handleLoadMore = useCallback(() => {
    if (nextPage !== null && !isLoadingMore && !isLoading && !isRefreshing) {
      void loadMore();
    }
  }, [isLoading, isLoadingMore, isRefreshing, loadMore, nextPage]);

  const filterTabs: { key: MerchantCampaignStatusFilter; label: string }[] = [
    { key: 'all', label: t.merchant.campaigns.filterAll },
    { key: 'active', label: t.merchant.campaigns.filterActive },
    { key: 'ended', label: t.merchant.campaigns.filterEnded },
  ];

  const renderCampaignItem = useCallback(
    ({ item }: { item: MerchantCampaign }) => {
      const isActive = item.status === 'active';
      const progress = computeSalesRatio(item);
      const progressPercentWidth = `${Math.round(progress.ratio * 100)}%` as const;

      return (
        <Pressable
          testID={`merchant-campaign-card-${item.id}`}
          onPress={() => handleOpenCampaign(item.id)}
          accessibilityRole="button"
          accessibilityLabel={item.productName}
          style={({ pressed }) => [
            styles.campaignCard,
            pressed ? styles.campaignCardPressed : null,
          ]}
        >
          <View style={styles.cardHeaderRow}>
            <Text
              style={[Typography.section, directionalText, styles.productName]}
              numberOfLines={2}
            >
              {item.productName}
            </Text>
            <StatusBadge
              label={isActive ? t.campaigns.activeStatus : t.campaigns.endedStatus}
              tone={isActive ? 'success' : 'neutral'}
              showDot
            />
          </View>

          <View style={styles.progressBlock}>
            <View style={styles.progressHeaderRow}>
              <Text style={[Typography.caption, directionalText]}>
                {t.merchant.campaigns.salesProgressLabel}
              </Text>
              <Text style={[Typography.label, directionalText, styles.progressCount]}>
                {progress.label}
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: progressPercentWidth },
                  !isActive ? styles.progressFillEnded : null,
                ]}
              />
            </View>
          </View>

          <View style={styles.cardMetricsGrid}>
            <View style={styles.metricCell}>
              <Text style={[Typography.caption, directionalText]}>
                {t.merchant.campaigns.remainingReserveLabel}
              </Text>
              <Text style={[Typography.label, directionalText, styles.reserveValue]}>
                {formatSyp(item.usage.lockedBudgetSyp, locale)}
              </Text>
            </View>

            <View style={styles.metricCellEnd}>
              <Text style={[Typography.caption, directionalText]}>
                {t.merchant.campaigns.endsAtLabel}
              </Text>
              <Text style={[Typography.label, directionalText]}>
                {formatCampaignDate(item.endsAt, locale)}
              </Text>
            </View>
          </View>
        </Pressable>
      );
    },
    [
      directionalText,
      handleOpenCampaign,
      locale,
      t.campaigns.activeStatus,
      t.campaigns.endedStatus,
      t.merchant.campaigns.endsAtLabel,
      t.merchant.campaigns.remainingReserveLabel,
      t.merchant.campaigns.salesProgressLabel,
    ],
  );

  const showInitialSkeleton = isLoading && !hasLoaded && items.length === 0;
  const hasFatalError = Boolean(errorMessage && !hasLoaded && items.length === 0);

  const emptySubtitle =
    statusFilter === 'active'
      ? t.merchant.campaigns.emptyActiveSubtitle
      : statusFilter === 'ended'
        ? t.merchant.campaigns.emptyEndedSubtitle
        : t.merchant.campaigns.emptySubtitle;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.fixedHeader}>
        <View style={styles.titleRow}>
          <Text style={[Typography.display, directionalText, styles.titleText]}>
            {t.merchant.campaigns.screenTitle}
          </Text>
          <AppButton
            testID="merchant-campaigns-create-button"
            variant="primary"
            fullWidth={false}
            label={t.merchant.campaigns.createAction}
            onPress={handleCreateCampaign}
          />
        </View>

        <View
          style={styles.filterTrack}
          accessibilityRole="tablist"
          accessibilityLabel={t.merchant.campaigns.screenTitle}
        >
          {filterTabs.map((tab) => {
            const selected = statusFilter === tab.key;
            return (
              <Pressable
                key={tab.key}
                testID={`merchant-campaigns-filter-${tab.key}`}
                onPress={() => setStatusFilter(tab.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={tab.label}
                style={[styles.filterTab, selected ? styles.filterTabActive : null]}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    selected ? styles.filterTabTextActive : null,
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <FlatList
        data={showInitialSkeleton || hasFatalError ? [] : items}
        keyExtractor={(item) => item.id}
        renderItem={renderCampaignItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.action}
            colors={[Colors.action]}
          />
        }
        ListHeaderComponent={
          errorMessage && (hasLoaded || items.length > 0) ? (
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
          ) : undefined
        }
        ListEmptyComponent={
          showInitialSkeleton ? (
            <View style={styles.skeletonStack}>
              <View style={styles.skeletonCard}>
                <View style={styles.skeletonHeader}>
                  <SkeletonBlock width="60%" height={22} />
                  <SkeletonBlock width={68} height={24} />
                </View>
                <SkeletonBlock width="100%" height={10} />
                <View style={styles.skeletonHeader}>
                  <SkeletonBlock width="42%" height={18} />
                  <SkeletonBlock width="34%" height={18} />
                </View>
              </View>
              <View style={styles.skeletonCard}>
                <View style={styles.skeletonHeader}>
                  <SkeletonBlock width="55%" height={22} />
                  <SkeletonBlock width={68} height={24} />
                </View>
                <SkeletonBlock width="100%" height={10} />
                <View style={styles.skeletonHeader}>
                  <SkeletonBlock width="42%" height={18} />
                  <SkeletonBlock width="34%" height={18} />
                </View>
              </View>
            </View>
          ) : hasFatalError ? (
            <View style={styles.errorCard} accessibilityLiveRegion="polite">
              <Text style={[Typography.section, directionalText, styles.errorTitle]}>
                {t.merchant.campaigns.loadError}
              </Text>
              <Text style={[Typography.body, directionalText, styles.mutedText]}>
                {errorMessage}
              </Text>
              <AppButton
                testID="merchant-campaigns-retry-button"
                variant="primary"
                label={t.common.retry}
                loading={isRefreshing}
                onPress={handleRefresh}
              />
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={[Typography.section, directionalText, styles.emptyTitle]}>
                {t.merchant.campaigns.emptyTitle}
              </Text>
              <Text style={[Typography.body, directionalText, styles.mutedText]}>
                {emptySubtitle}
              </Text>
              <AppButton
                variant={statusFilter === 'all' ? 'primary' : 'secondary'}
                label={
                  statusFilter === 'all'
                    ? t.merchant.campaigns.createAction
                    : t.merchant.campaigns.refreshList
                }
                loading={statusFilter !== 'all' && isRefreshing}
                onPress={statusFilter === 'all' ? handleCreateCampaign : handleRefresh}
              />
            </View>
          )
        }
        ListFooterComponent={
          nextPage !== null ? (
            <View style={styles.footerLoader}>
              <AppButton
                testID="merchant-campaigns-load-more-button"
                variant="secondary"
                label={t.merchant.campaigns.loadMore}
                loadingLabel={t.merchant.campaigns.loadingMore}
                loading={isLoadingMore}
                disabled={isLoadingMore || isRefreshing}
                onPress={handleLoadMore}
              />
            </View>
          ) : undefined
        }
        onEndReachedThreshold={0.35}
        onEndReached={handleLoadMore}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  fixedHeader: {
    paddingHorizontal: Spacing.gutter,
    paddingTop: Spacing.gutter,
    paddingBottom: Spacing.compact + 4,
    gap: Spacing.compact + 4,
    backgroundColor: Colors.canvas,
    borderBottomWidth: BorderWidth.hairline,
    borderBottomColor: Colors.rule,
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
  filterTrack: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radii.control,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.controlBorder,
    padding: Spacing.xs,
    gap: Spacing.xs,
  },
  filterTab: {
    flex: 1,
    minHeight: TouchTarget.minHeight,
    minWidth: TouchTarget.minWidth,
    borderRadius: Radii.control - 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.compact,
  },
  filterTabActive: {
    backgroundColor: Colors.action,
  },
  filterTabText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.ink,
    textAlign: 'center',
  },
  filterTabTextActive: {
    color: Colors.onInk,
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.gutter,
    paddingTop: Spacing.gutter,
    paddingBottom: Spacing.section,
    gap: Spacing.gutter,
  },
  campaignCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.gutter,
    gap: Spacing.compact + 4,
  },
  campaignCardPressed: {
    opacity: 0.9,
    borderColor: Colors.controlBorder,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.compact,
  },
  productName: {
    flex: 1,
    flexShrink: 1,
  },
  progressBlock: {
    gap: Spacing.xs + 2,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.compact,
  },
  progressCount: {
    color: Colors.ink,
    fontFamily: FontFamily.bold,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.mauveTint,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: Colors.action,
  },
  progressFillEnded: {
    backgroundColor: Colors.dustyMauve,
  },
  cardMetricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.compact,
    paddingTop: Spacing.compact,
    borderTopWidth: BorderWidth.hairline,
    borderTopColor: Colors.rule,
  },
  metricCell: {
    gap: Spacing.xs,
    flexShrink: 1,
  },
  metricCellEnd: {
    gap: Spacing.xs,
    flexShrink: 1,
  },
  reserveValue: {
    color: Colors.action,
    fontFamily: FontFamily.bold,
  },
  skeletonStack: {
    gap: Spacing.gutter,
  },
  skeletonCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.gutter,
    gap: Spacing.compact + 4,
  },
  skeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.compact,
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
  emptyCard: {
    backgroundColor: Colors.mauveTint,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.section,
    gap: Spacing.gutter,
  },
  emptyTitle: {
    color: Colors.ink,
  },
  mutedText: {
    color: Colors.muted,
  },
  footerLoader: {
    paddingTop: Spacing.xs,
  },
});
