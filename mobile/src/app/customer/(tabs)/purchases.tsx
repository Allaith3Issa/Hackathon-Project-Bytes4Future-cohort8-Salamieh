import { useIsFocused } from 'expo-router';
import { useCallback } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, SkeletonBlock, StatusBadge } from '@/components/ui';
import { useLocale } from '@/core/i18n';
import { useAndroidBack } from '@/core/navigation';
import {
  formatCampaignDate,
  formatSyp,
  getDirectionalTextStyle,
  isolateLtr,
} from '@/core/rtl';
import {
  BorderWidth,
  Colors,
  FontFamily,
  Radii,
  Spacing,
  Typography,
} from '@/core/theme';
import { useCustomerPurchases } from '@/features/customer/purchases';
import type { CustomerPurchase } from '@/features/customer/purchases';

export default function CustomerPurchasesScreen() {
  const { locale, t } = useLocale();
  const isFocused = useIsFocused();
  const directionalText = getDirectionalTextStyle(locale);

  const {
    items,
    nextPage,
    total,
    hasLoaded,
    isLoading,
    isRefreshing,
    isLoadingMore,
    errorMessage,
    loadMoreErrorMessage,
    refresh,
    loadMore,
  } = useCustomerPurchases();

  useAndroidBack({
    enabled: isFocused,
    isRootTab: true,
  });

  const handleRefresh = useCallback(() => {
    void refresh();
  }, [refresh]);

  const handleLoadMore = useCallback(() => {
    if (
      nextPage !== null &&
      !loadMoreErrorMessage &&
      !isLoadingMore &&
      !isLoading &&
      !isRefreshing
    ) {
      void loadMore();
    }
  }, [
    isLoading,
    isLoadingMore,
    isRefreshing,
    loadMore,
    loadMoreErrorMessage,
    nextPage,
  ]);

  const handleRetryLoadMore = useCallback(() => {
    if (!isLoadingMore && !isLoading && !isRefreshing) {
      void loadMore();
    }
  }, [isLoading, isLoadingMore, isRefreshing, loadMore]);

  const formattedCount = useCallback(
    (value: number) =>
      new Intl.NumberFormat(locale === 'ar' ? 'ar-SY' : 'en-US').format(value),
    [locale],
  );

  const renderPurchaseItem = useCallback(
    ({ item }: { item: CustomerPurchase }) => {
      const cashPaidText = formatSyp(item.customerPaidCashSyp, locale);
      const cashbackText = formatSyp(item.cashbackEarnedSyp, locale);
      const cashbackBadgeText = `${isolateLtr('+')} ${cashbackText}`;

      return (
        <View
          testID={`customer-purchase-card-${item.saleId}`}
          style={styles.purchaseCard}
        >
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardTitleBlock}>
              <Text
                style={[Typography.section, directionalText, styles.productName]}
                numberOfLines={2}
              >
                {item.productName}
              </Text>
              <Text style={[Typography.label, directionalText, styles.shopName]}>
                {`${t.customer.purchases.shopLabel}: ${item.shopName}`}
              </Text>
            </View>
            <StatusBadge label={cashbackBadgeText} tone="success" showDot />
          </View>

          <View style={styles.detailsPanel}>
            <View style={styles.detailRow}>
              <Text style={[Typography.caption, directionalText, styles.detailText]}>
                {t.customer.purchases.quantityLabel}
              </Text>
              <Text style={[Typography.label, styles.tabularNum, styles.detailText]}>
                {formattedCount(item.quantity)}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={[Typography.caption, directionalText, styles.detailText]}>
                {t.customer.purchases.paidCashLabel}
              </Text>
              <Text
                style={[
                  Typography.label,
                  styles.tabularNum,
                  styles.detailText,
                  styles.cashPaidValue,
                ]}
              >
                {cashPaidText}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={[Typography.caption, directionalText, styles.detailText]}>
                {t.customer.purchases.cashbackEarnedLabel}
              </Text>
              <Text
                style={[
                  Typography.label,
                  styles.tabularNum,
                  styles.detailText,
                  styles.cashbackEarnedValue,
                ]}
              >
                {cashbackText}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={[Typography.caption, directionalText, styles.detailText]}>
                {t.customer.purchases.scannedAtLabel}
              </Text>
              <Text style={[Typography.caption, styles.tabularNum, styles.detailText]}>
                {formatCampaignDate(item.scannedAt, locale)}
              </Text>
            </View>
          </View>
        </View>
      );
    },
    [
      directionalText,
      formattedCount,
      locale,
      t.customer.purchases.cashbackEarnedLabel,
      t.customer.purchases.paidCashLabel,
      t.customer.purchases.quantityLabel,
      t.customer.purchases.scannedAtLabel,
      t.customer.purchases.shopLabel,
    ],
  );

  const showInitialSkeleton = isLoading && !hasLoaded && items.length === 0;
  const hasFatalError = Boolean(errorMessage && !hasLoaded && items.length === 0);

  const listHeaderComponent = (
    <View style={styles.headerBlock}>
      <View style={styles.titleRow}>
        <Text style={[Typography.display, directionalText, styles.titleText]}>
          {t.customer.purchases.screenTitle}
        </Text>
        <StatusBadge
          label={
            hasLoaded && total > 0
              ? `${t.profile.roleCustomer} · ${isolateLtr(formattedCount(total))}`
              : t.profile.roleCustomer
          }
          tone="mauve"
        />
      </View>

      {errorMessage && (hasLoaded || items.length > 0) ? (
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
    </View>
  );

  const listEmptyComponent = showInitialSkeleton ? (
    <View style={styles.skeletonStack}>
      <View style={styles.skeletonCard}>
        <View style={styles.skeletonRow}>
          <SkeletonBlock width="58%" height={24} />
          <SkeletonBlock width={88} height={26} borderRadius={999} />
        </View>
        <SkeletonBlock width="44%" height={18} />
        <SkeletonBlock width="100%" height={92} borderRadius={Radii.control} />
      </View>
      <View style={styles.skeletonCard}>
        <View style={styles.skeletonRow}>
          <SkeletonBlock width="52%" height={24} />
          <SkeletonBlock width={88} height={26} borderRadius={999} />
        </View>
        <SkeletonBlock width="38%" height={18} />
        <SkeletonBlock width="100%" height={92} borderRadius={Radii.control} />
      </View>
      <View style={styles.skeletonCard}>
        <View style={styles.skeletonRow}>
          <SkeletonBlock width="62%" height={24} />
          <SkeletonBlock width={88} height={26} borderRadius={999} />
        </View>
        <SkeletonBlock width="46%" height={18} />
        <SkeletonBlock width="100%" height={92} borderRadius={Radii.control} />
      </View>
    </View>
  ) : hasFatalError ? (
    <View style={styles.errorCard} accessibilityLiveRegion="polite">
      <Text style={[Typography.section, directionalText, styles.errorTitle]}>
        {t.customer.purchases.loadError}
      </Text>
      <Text style={[Typography.body, directionalText, styles.mutedText]}>
        {errorMessage}
      </Text>
      <AppButton
        testID="customer-purchases-retry-button"
        variant="primary"
        label={t.common.retry}
        loading={isRefreshing}
        onPress={handleRefresh}
      />
    </View>
  ) : (
    <View style={styles.emptyCard}>
      <Text style={[Typography.section, directionalText]}>
        {t.customer.purchases.emptyTitle}
      </Text>
      <Text style={[Typography.body, directionalText, styles.mutedText]}>
        {t.customer.purchases.emptySubtitle}
      </Text>
      <AppButton
        testID="customer-purchases-refresh-button"
        variant="secondary"
        label={t.customer.purchases.refreshAction}
        loading={isRefreshing}
        onPress={handleRefresh}
      />
    </View>
  );

  const listFooterComponent =
    nextPage !== null || loadMoreErrorMessage ? (
      <View style={styles.footerLoader}>
        {loadMoreErrorMessage ? (
          <View style={styles.inlineErrorBanner} accessibilityLiveRegion="polite">
            <Text style={[Typography.label, directionalText, styles.errorTitle]}>
              {loadMoreErrorMessage}
            </Text>
            <AppButton
              testID="customer-purchases-load-more-retry-button"
              variant="secondary"
              label={t.common.retry}
              loadingLabel={t.customer.purchases.loadingMore}
              loading={isLoadingMore}
              disabled={isLoadingMore || isRefreshing}
              onPress={handleRetryLoadMore}
            />
          </View>
        ) : (
          <AppButton
            testID="customer-purchases-load-more-button"
            variant="secondary"
            label={t.customer.purchases.loadMore}
            loadingLabel={t.customer.purchases.loadingMore}
            loading={isLoadingMore}
            disabled={isLoadingMore || isRefreshing}
            onPress={handleLoadMore}
          />
        )}
      </View>
    ) : undefined;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <FlatList
        data={showInitialSkeleton || hasFatalError ? [] : items}
        keyExtractor={(item) => item.saleId}
        renderItem={renderPurchaseItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={listHeaderComponent}
        ListEmptyComponent={listEmptyComponent}
        ListFooterComponent={listFooterComponent}
        onEndReachedThreshold={0.35}
        onEndReached={handleLoadMore}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.action}
            colors={[Colors.action]}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.gutter,
    paddingTop: Spacing.gutter,
    paddingBottom: Spacing.section * 2,
    gap: Spacing.compact + 4,
  },
  headerBlock: {
    gap: Spacing.gutter,
    marginBottom: Spacing.xs,
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
  purchaseCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.gutter,
    gap: Spacing.compact + 4,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.compact,
  },
  cardTitleBlock: {
    flexGrow: 1,
    flexShrink: 1,
    gap: Spacing.xs,
  },
  productName: {
    color: Colors.ink,
  },
  shopName: {
    color: Colors.action,
  },
  detailsPanel: {
    backgroundColor: Colors.canvas,
    borderRadius: Radii.control,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.compact + 4,
    gap: Spacing.compact,
  },
  detailRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.compact,
  },
  detailText: {
    flexShrink: 1,
  },
  cashPaidValue: {
    fontFamily: FontFamily.bold,
    color: Colors.ink,
  },
  cashbackEarnedValue: {
    fontFamily: FontFamily.bold,
    color: Colors.success,
  },
  skeletonStack: {
    gap: Spacing.compact + 4,
  },
  skeletonCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.gutter,
    gap: Spacing.compact,
  },
  skeletonRow: {
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
    backgroundColor: Colors.surface,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.section,
    gap: Spacing.gutter,
  },
  mutedText: {
    color: Colors.muted,
  },
  footerLoader: {
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.compact,
  },
  tabularNum: {
    fontVariant: ['tabular-nums'],
  },
});
