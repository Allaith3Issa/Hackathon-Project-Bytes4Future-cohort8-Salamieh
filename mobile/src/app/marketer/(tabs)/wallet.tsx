import { useIsFocused } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AppButton,
  BalanceCard,
  SkeletonBlock,
  StatusBadge,
} from '@/components/ui';
import type { StatusBadgeTone } from '@/components/ui';
import { useLocale } from '@/core/i18n';
import { useAndroidBack } from '@/core/navigation';
import {
  formatCampaignDate,
  formatPercent,
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
  TabularNumberStyle,
  TouchTarget,
  Typography,
} from '@/core/theme';
import {
  DEFAULT_MARKETER_WALLET_PAGE_SIZE,
  useMarketerEarningsByMerchant,
  useMarketerStats,
  useMarketerTransactions,
  useMarketerWallet,
} from '@/features/marketer/wallet';
import type {
  MarketerMerchantEarnings,
  MarketerWalletTransaction,
  MarketerWalletTransactionKind,
} from '@/features/marketer/wallet';

type MarketerWalletSubTab = 'stats' | 'by_merchant' | 'transactions';

type MarketerWalletListItem =
  | { type: 'merchant'; key: string; item: MarketerMerchantEarnings }
  | { type: 'transaction'; key: string; item: MarketerWalletTransaction };

function formatCount(value: number, locale: 'ar' | 'en'): string {
  const safeValue = Number.isFinite(value) ? Math.trunc(value) : 0;
  try {
    return new Intl.NumberFormat(locale === 'ar' ? 'ar-SY' : 'en-US').format(safeValue);
  } catch {
    return String(safeValue);
  }
}

function getTransactionVisualMeta(kind: MarketerWalletTransactionKind): {
  tone: StatusBadgeTone;
  directionSign: '+' | '-' | null;
  amountTone: 'positive' | 'debit' | 'danger';
} {
  switch (kind) {
    case 'marketer_commission_credit':
      return { tone: 'success', directionSign: '+', amountTone: 'positive' };
    case 'payout_release_refund':
      return { tone: 'info', directionSign: '+', amountTone: 'positive' };
    case 'payout_hold':
      return { tone: 'mauve', directionSign: '-', amountTone: 'debit' };
    case 'payout_completed':
      return { tone: 'action', directionSign: '-', amountTone: 'debit' };
    case 'payout_transfer_reversal':
      return { tone: 'danger', directionSign: null, amountTone: 'danger' };
  }
}

export default function MarketerWalletScreen() {
  const { locale, t } = useLocale();
  const isFocused = useIsFocused();
  const directionalText = getDirectionalTextStyle(locale);

  const [activeTab, setActiveTab] = useState<MarketerWalletSubTab>('stats');

  const {
    wallet,
    availableBalanceSyp,
    pendingPayoutSyp,
    totalEarnedSyp,
    isLoading: isWalletLoading,
    isRefreshing: isWalletRefreshing,
    errorMessage: walletErrorMessage,
    refresh: refreshWallet,
  } = useMarketerWallet();

  const {
    stats,
    clicks,
    itemsSold: statsItemsSold,
    earnedSyp: statsEarnedSyp,
    conversionRatePercent,
    isLoading: isStatsLoading,
    isRefreshing: isStatsRefreshing,
    errorMessage: statsErrorMessage,
    refresh: refreshStats,
  } = useMarketerStats({ enabled: activeTab === 'stats' });

  const {
    items: merchantEarnings,
    nextPage: byMerchantNextPage,
    hasLoaded: hasLoadedByMerchant,
    isLoading: isByMerchantLoading,
    isRefreshing: isByMerchantRefreshing,
    isLoadingMore: isLoadingMoreByMerchant,
    errorMessage: byMerchantErrorMessage,
    loadMoreErrorMessage: byMerchantLoadMoreErrorMessage,
    refresh: refreshByMerchant,
    loadMore: loadMoreByMerchant,
  } = useMarketerEarningsByMerchant(DEFAULT_MARKETER_WALLET_PAGE_SIZE, {
    enabled: activeTab === 'by_merchant',
  });

  const {
    items: transactions,
    nextPage: transactionsNextPage,
    hasLoaded: hasLoadedTransactions,
    isLoading: isTransactionsLoading,
    isRefreshing: isTransactionsRefreshing,
    isLoadingMore: isLoadingMoreTransactions,
    errorMessage: transactionsErrorMessage,
    loadMoreErrorMessage: transactionsLoadMoreErrorMessage,
    refresh: refreshTransactions,
    loadMore: loadMoreTransactions,
  } = useMarketerTransactions(DEFAULT_MARKETER_WALLET_PAGE_SIZE, {
    enabled: activeTab === 'transactions',
  });

  useAndroidBack({
    enabled: isFocused,
    isRootTab: true,
  });

  const subTabs = useMemo<{ key: MarketerWalletSubTab; label: string }[]>(
    () => [
      { key: 'stats', label: t.wallet.tabStats },
      { key: 'by_merchant', label: t.wallet.tabByMerchant },
      { key: 'transactions', label: t.wallet.tabTransactions },
    ],
    [t.wallet.tabByMerchant, t.wallet.tabStats, t.wallet.tabTransactions],
  );

  const isRefreshingActiveSection =
    activeTab === 'stats'
      ? isStatsRefreshing
      : activeTab === 'by_merchant'
        ? isByMerchantRefreshing
        : isTransactionsRefreshing;

  const isPullRefreshing = isWalletRefreshing || isRefreshingActiveSection;

  const handleRefreshWallet = useCallback(() => {
    void refreshWallet(true);
  }, [refreshWallet]);

  const handleRefreshActiveSection = useCallback(() => {
    if (activeTab === 'stats') {
      void refreshStats(true);
      return;
    }
    if (activeTab === 'by_merchant') {
      void refreshByMerchant();
      return;
    }
    void refreshTransactions();
  }, [activeTab, refreshByMerchant, refreshStats, refreshTransactions]);

  const handleRefresh = useCallback(() => {
    if (activeTab === 'stats') {
      void Promise.all([refreshWallet(true), refreshStats(true)]);
      return;
    }
    if (activeTab === 'by_merchant') {
      void Promise.all([refreshWallet(true), refreshByMerchant()]);
      return;
    }
    void Promise.all([refreshWallet(true), refreshTransactions()]);
  }, [activeTab, refreshByMerchant, refreshStats, refreshTransactions, refreshWallet]);

  const activeNextPage =
    activeTab === 'by_merchant'
      ? byMerchantNextPage
      : activeTab === 'transactions'
        ? transactionsNextPage
        : null;

  const activeIsLoading =
    activeTab === 'by_merchant'
      ? isByMerchantLoading
      : activeTab === 'transactions'
        ? isTransactionsLoading
        : isStatsLoading;

  const activeIsLoadingMore =
    activeTab === 'by_merchant'
      ? isLoadingMoreByMerchant
      : activeTab === 'transactions'
        ? isLoadingMoreTransactions
        : false;

  const activeLoadMoreErrorMessage =
    activeTab === 'by_merchant'
      ? byMerchantLoadMoreErrorMessage
      : activeTab === 'transactions'
        ? transactionsLoadMoreErrorMessage
        : null;

  const handleLoadMore = useCallback(() => {
    if (
      activeNextPage === null ||
      activeLoadMoreErrorMessage ||
      activeIsLoadingMore ||
      activeIsLoading ||
      isRefreshingActiveSection
    ) {
      return;
    }
    if (activeTab === 'by_merchant') {
      void loadMoreByMerchant();
    } else if (activeTab === 'transactions') {
      void loadMoreTransactions();
    }
  }, [
    activeIsLoading,
    activeIsLoadingMore,
    activeLoadMoreErrorMessage,
    activeNextPage,
    activeTab,
    isRefreshingActiveSection,
    loadMoreByMerchant,
    loadMoreTransactions,
  ]);

  const handleRetryLoadMore = useCallback(() => {
    if (activeIsLoadingMore || activeIsLoading || isRefreshingActiveSection) {
      return;
    }
    if (activeTab === 'by_merchant') {
      void loadMoreByMerchant();
    } else if (activeTab === 'transactions') {
      void loadMoreTransactions();
    }
  }, [
    activeIsLoading,
    activeIsLoadingMore,
    activeTab,
    isRefreshingActiveSection,
    loadMoreByMerchant,
    loadMoreTransactions,
  ]);

  const listData = useMemo<MarketerWalletListItem[]>(() => {
    if (activeTab === 'by_merchant') {
      const showSkeleton =
        isByMerchantLoading && !hasLoadedByMerchant && merchantEarnings.length === 0;
      const hasFatal = Boolean(
        byMerchantErrorMessage && !hasLoadedByMerchant && merchantEarnings.length === 0,
      );
      if (showSkeleton || hasFatal) {
        return [];
      }
      return merchantEarnings.map((entry) => ({
        type: 'merchant',
        key: `merchant:${entry.merchantId}`,
        item: entry,
      }));
    }

    if (activeTab === 'transactions') {
      const showSkeleton =
        isTransactionsLoading && !hasLoadedTransactions && transactions.length === 0;
      const hasFatal = Boolean(
        transactionsErrorMessage && !hasLoadedTransactions && transactions.length === 0,
      );
      if (showSkeleton || hasFatal) {
        return [];
      }
      return transactions.map((entry) => ({
        type: 'transaction',
        key: `tx:${entry.id}`,
        item: entry,
      }));
    }

    return [];
  }, [
    activeTab,
    byMerchantErrorMessage,
    hasLoadedByMerchant,
    hasLoadedTransactions,
    isByMerchantLoading,
    isTransactionsLoading,
    merchantEarnings,
    transactions,
    transactionsErrorMessage,
  ]);

  const renderListItem = useCallback(
    ({ item }: { item: MarketerWalletListItem }) => {
      if (item.type === 'merchant') {
        const merchant = item.item;
        const formattedTotal = formatSyp(merchant.totalEarnedSyp, locale);

        return (
          <View
            testID={`marketer-by-merchant-${merchant.merchantId}`}
            style={styles.reportCard}
          >
            <View style={styles.cardTopRow}>
              <Text style={[Typography.section, directionalText, styles.shopNameText]}>
                {merchant.shopName}
              </Text>
              <Text
                style={[
                  Typography.section,
                  directionalText,
                  TabularNumberStyle,
                  styles.positiveAmount,
                ]}
              >
                {formattedTotal}
              </Text>
            </View>

            <View style={styles.merchantMetricsRow}>
              <View style={styles.merchantMetricCell}>
                <Text style={[Typography.caption, directionalText]}>
                  {t.wallet.salesCountLabel}
                </Text>
                <Text
                  style={[
                    Typography.body,
                    directionalText,
                    TabularNumberStyle,
                    styles.metricValue,
                  ]}
                >
                  {formatCount(merchant.salesCount, locale)}
                </Text>
              </View>

              <View style={styles.merchantMetricCell}>
                <Text style={[Typography.caption, directionalText]}>
                  {t.wallet.itemsSoldLabel}
                </Text>
                <Text
                  style={[
                    Typography.body,
                    directionalText,
                    TabularNumberStyle,
                    styles.metricValue,
                  ]}
                >
                  {formatCount(merchant.itemsSold, locale)}
                </Text>
              </View>

              <View style={styles.merchantMetricCell}>
                <Text style={[Typography.caption, directionalText]}>
                  {t.wallet.totalEarnedMerchantLabel}
                </Text>
                <Text
                  style={[
                    Typography.body,
                    directionalText,
                    TabularNumberStyle,
                    styles.metricValue,
                  ]}
                >
                  {formattedTotal}
                </Text>
              </View>
            </View>
          </View>
        );
      }

      const tx = item.item;
      const meta = getTransactionVisualMeta(tx.kind);
      const kindLabel = t.wallet.kinds[tx.kind];
      const formattedAmount = formatSyp(tx.amountSyp, locale);
      const displayAmount = meta.directionSign
        ? `${isolateLtr(meta.directionSign)} ${formattedAmount}`
        : formattedAmount;

      return (
        <View
          testID={`marketer-wallet-tx-${tx.id}`}
          style={styles.reportCard}
        >
          <View style={styles.cardTopRow}>
            <StatusBadge label={kindLabel} tone={meta.tone} showDot />
            <Text
              style={[
                Typography.section,
                directionalText,
                TabularNumberStyle,
                styles.txAmount,
                meta.amountTone === 'positive'
                  ? styles.positiveAmount
                  : meta.amountTone === 'danger'
                    ? styles.dangerAmount
                    : styles.debitAmount,
              ]}
            >
              {displayAmount}
            </Text>
          </View>

          {tx.campaignName ? (
            <Text style={[Typography.body, directionalText, styles.campaignNameText]}>
              {tx.campaignName}
            </Text>
          ) : null}

          <View style={styles.txMetaRow}>
            {tx.shopName ? (
              <Text style={[Typography.caption, directionalText, styles.shopSubtitle]}>
                {tx.shopName}
              </Text>
            ) : (
              <View />
            )}
            <Text style={[Typography.caption, directionalText, TabularNumberStyle]}>
              {formatCampaignDate(tx.createdAt, locale)}
            </Text>
          </View>
        </View>
      );
    },
    [
      directionalText,
      locale,
      t.wallet.itemsSoldLabel,
      t.wallet.kinds,
      t.wallet.salesCountLabel,
      t.wallet.totalEarnedMerchantLabel,
    ],
  );

  const hasInitialWalletError = Boolean(walletErrorMessage && !wallet);
  const showWalletBalanceSkeleton = isWalletLoading && !wallet && !hasInitialWalletError;

  const sectionTitle =
    activeTab === 'stats'
      ? t.wallet.statsTitle
      : activeTab === 'by_merchant'
        ? t.wallet.byMerchantTitle
        : t.wallet.transactionsTitle;

  const activeInlineError =
    activeTab === 'by_merchant' &&
    byMerchantErrorMessage &&
    (hasLoadedByMerchant || merchantEarnings.length > 0)
      ? byMerchantErrorMessage
      : activeTab === 'transactions' &&
          transactionsErrorMessage &&
          (hasLoadedTransactions || transactions.length > 0)
        ? transactionsErrorMessage
        : activeTab === 'stats' && statsErrorMessage && stats
          ? statsErrorMessage
          : null;

  const listHeader = (
    <View style={styles.headerStack}>
      <View style={styles.titleRow}>
        <Text style={[Typography.display, directionalText, styles.titleText]}>
          {t.wallet.screenTitle}
        </Text>
        <StatusBadge label={t.profile.roleMarketer} tone="mauve" />
      </View>

      {hasInitialWalletError ? (
        <View style={styles.errorCard} accessibilityLiveRegion="polite">
          <Text style={[Typography.section, directionalText, styles.errorText]}>
            {t.wallet.loadError}
          </Text>
          <Text style={[Typography.body, directionalText, styles.mutedText]}>
            {walletErrorMessage}
          </Text>
          <AppButton
            testID="wallet-retry-button"
            variant="primary"
            label={t.common.retry}
            loading={isWalletRefreshing}
            onPress={handleRefreshWallet}
          />
        </View>
      ) : (
        <View style={styles.balancesGroup}>
          <BalanceCard
            testID="wallet-available-balance-card"
            variant="primary"
            label={t.wallet.availableBalance}
            amountSyp={availableBalanceSyp}
            loading={showWalletBalanceSkeleton}
            hint={t.wallet.balanceHint}
          />

          <View style={styles.secondaryBalancesRow}>
            <View
              testID="wallet-pending-payout-card"
              style={styles.secondaryBalanceCard}
              accessible
              accessibilityRole="summary"
              accessibilityLabel={
                showWalletBalanceSkeleton
                  ? t.wallet.pendingPayout
                  : `${t.wallet.pendingPayout}: ${formatSyp(pendingPayoutSyp, locale)}`
              }
            >
              <Text style={[Typography.label, directionalText, styles.secondaryBalanceLabel]}>
                {t.wallet.pendingPayout}
              </Text>
              {showWalletBalanceSkeleton ? (
                <SkeletonBlock width="78%" height={24} borderRadius={Radii.control} />
              ) : (
                <Text
                  style={[
                    Typography.section,
                    directionalText,
                    TabularNumberStyle,
                    styles.pendingPayoutAmount,
                  ]}
                >
                  {formatSyp(pendingPayoutSyp, locale)}
                </Text>
              )}
            </View>

            <View
              testID="wallet-total-earned-card"
              style={[styles.secondaryBalanceCard, styles.totalEarnedCard]}
              accessible
              accessibilityRole="summary"
              accessibilityLabel={
                showWalletBalanceSkeleton
                  ? t.wallet.totalEarned
                  : `${t.wallet.totalEarned}: ${formatSyp(totalEarnedSyp, locale)}`
              }
            >
              <Text style={[Typography.label, directionalText, styles.secondaryBalanceLabel]}>
                {t.wallet.totalEarned}
              </Text>
              {showWalletBalanceSkeleton ? (
                <SkeletonBlock width="78%" height={24} borderRadius={Radii.control} />
              ) : (
                <Text
                  style={[
                    Typography.section,
                    directionalText,
                    TabularNumberStyle,
                    styles.totalEarnedAmount,
                  ]}
                >
                  {formatSyp(totalEarnedSyp, locale)}
                </Text>
              )}
            </View>
          </View>

          {walletErrorMessage ? (
            <View style={styles.inlineErrorBanner} accessibilityLiveRegion="polite">
              <Text style={[Typography.label, directionalText, styles.errorText]}>
                {walletErrorMessage}
              </Text>
              <AppButton
                testID="wallet-summary-retry-button"
                variant="secondary"
                fullWidth={false}
                label={t.common.retry}
                loading={isWalletRefreshing}
                onPress={handleRefreshWallet}
              />
            </View>
          ) : null}
        </View>
      )}

      <View
        style={styles.subTabTrack}
        accessibilityRole="tablist"
        accessibilityLabel={t.wallet.tabsLabel}
      >
        {subTabs.map((tab) => {
          const selected = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              testID={`marketer-wallet-tab-${tab.key}`}
              onPress={() => setActiveTab(tab.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={tab.label}
              style={[styles.subTabButton, selected ? styles.subTabButtonActive : null]}
            >
              <Text
                style={[
                  styles.subTabText,
                  selected ? styles.subTabTextActive : null,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.sectionHeaderRow}>
        <Text style={[Typography.section, directionalText]}>{sectionTitle}</Text>
      </View>

      {activeInlineError ? (
        <View style={styles.inlineErrorBanner} accessibilityLiveRegion="polite">
          <Text style={[Typography.label, directionalText, styles.errorText]}>
            {activeInlineError}
          </Text>
          <AppButton
            variant="secondary"
            fullWidth={false}
            label={t.common.retry}
            loading={isRefreshingActiveSection}
            onPress={handleRefreshActiveSection}
          />
        </View>
      ) : null}
    </View>
  );

  const renderSkeletonCards = (count: number) => (
    <View style={styles.skeletonStack}>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={styles.skeletonCard}>
          <View style={styles.skeletonRow}>
            <SkeletonBlock width={130} height={22} />
            <SkeletonBlock width={88} height={22} />
          </View>
          <SkeletonBlock width="68%" height={18} />
          <SkeletonBlock width="42%" height={14} />
        </View>
      ))}
    </View>
  );

  let listEmptyComponent: ReactElement | undefined;

  if (activeTab === 'stats') {
    if (isStatsLoading && !stats) {
      listEmptyComponent = (
        <View style={styles.statsGrid}>
          {[0, 1, 2, 3].map((slot) => (
            <View key={slot} style={styles.statCard}>
              <SkeletonBlock width="58%" height={14} />
              <SkeletonBlock width="72%" height={26} />
            </View>
          ))}
        </View>
      );
    } else if (statsErrorMessage && !stats) {
      listEmptyComponent = (
        <View style={styles.errorCard} accessibilityLiveRegion="polite">
          <Text style={[Typography.section, directionalText, styles.errorText]}>
            {t.wallet.statsLoadError}
          </Text>
          <Text style={[Typography.body, directionalText, styles.mutedText]}>
            {statsErrorMessage}
          </Text>
          <AppButton
            testID="marketer-stats-retry-button"
            variant="primary"
            label={t.common.retry}
            loading={isRefreshingActiveSection}
            onPress={handleRefreshActiveSection}
          />
        </View>
      );
    } else {
      listEmptyComponent = (
        <View style={styles.statsWrapper}>
          <View style={styles.statsGrid}>
            <View
              testID="marketer-stat-clicks"
              style={styles.statCard}
              accessible
              accessibilityLabel={`${t.wallet.clicksLabel}: ${formatCount(clicks, locale)}`}
            >
              <Text style={[Typography.caption, directionalText]}>
                {t.wallet.clicksLabel}
              </Text>
              <Text
                style={[
                  Typography.display,
                  directionalText,
                  TabularNumberStyle,
                  styles.statValue,
                ]}
              >
                {formatCount(clicks, locale)}
              </Text>
            </View>

            <View
              testID="marketer-stat-items-sold"
              style={styles.statCard}
              accessible
              accessibilityLabel={`${t.wallet.itemsSoldLabel}: ${formatCount(statsItemsSold, locale)}`}
            >
              <Text style={[Typography.caption, directionalText]}>
                {t.wallet.itemsSoldLabel}
              </Text>
              <Text
                style={[
                  Typography.display,
                  directionalText,
                  TabularNumberStyle,
                  styles.statValue,
                ]}
              >
                {formatCount(statsItemsSold, locale)}
              </Text>
            </View>

            <View
              testID="marketer-stat-conversion-rate"
              style={styles.statCard}
              accessible
              accessibilityLabel={`${t.wallet.conversionRateLabel}: ${formatPercent(conversionRatePercent, locale)}`}
            >
              <Text style={[Typography.caption, directionalText]}>
                {t.wallet.conversionRateLabel}
              </Text>
              <Text
                style={[
                  Typography.display,
                  directionalText,
                  TabularNumberStyle,
                  styles.statValueAccent,
                ]}
              >
                {formatPercent(conversionRatePercent, locale)}
              </Text>
            </View>

            <View
              testID="marketer-stat-earned"
              style={styles.statCard}
              accessible
              accessibilityLabel={`${t.wallet.earnedLabel}: ${formatSyp(statsEarnedSyp, locale)}`}
            >
              <Text style={[Typography.caption, directionalText]}>
                {t.wallet.earnedLabel}
              </Text>
              <Text
                style={[
                  Typography.section,
                  directionalText,
                  TabularNumberStyle,
                  styles.statValueSuccess,
                ]}
              >
                {formatSyp(statsEarnedSyp, locale)}
              </Text>
            </View>
          </View>

          <View style={styles.infoPanel}>
            <Text style={[Typography.body, directionalText, styles.mutedText]}>
              {t.wallet.lastUpdatedLabel}
            </Text>
            <AppButton
              testID="wallet-refresh-button"
              variant="secondary"
              label={t.wallet.refreshAction}
              loading={isPullRefreshing}
              onPress={handleRefresh}
            />
          </View>
        </View>
      );
    }
  } else if (activeTab === 'by_merchant') {
    const showSkeleton =
      isByMerchantLoading && !hasLoadedByMerchant && merchantEarnings.length === 0;
    const hasFatal = Boolean(
      byMerchantErrorMessage && !hasLoadedByMerchant && merchantEarnings.length === 0,
    );

    if (showSkeleton) {
      listEmptyComponent = renderSkeletonCards(3);
    } else if (hasFatal) {
      listEmptyComponent = (
        <View style={styles.errorCard} accessibilityLiveRegion="polite">
          <Text style={[Typography.section, directionalText, styles.errorText]}>
            {t.wallet.byMerchantLoadError}
          </Text>
          <Text style={[Typography.body, directionalText, styles.mutedText]}>
            {byMerchantErrorMessage}
          </Text>
          <AppButton
            testID="marketer-by-merchant-retry-button"
            variant="primary"
            label={t.common.retry}
            loading={isRefreshingActiveSection}
            onPress={handleRefreshActiveSection}
          />
        </View>
      );
    } else {
      listEmptyComponent = (
        <View style={styles.emptyCard}>
          <Text style={[Typography.section, directionalText, styles.emptyTitle]}>
            {t.wallet.emptyByMerchantTitle}
          </Text>
          <Text style={[Typography.body, directionalText, styles.mutedText]}>
            {t.wallet.emptyByMerchantSubtitle}
          </Text>
          <AppButton
            variant="secondary"
            label={t.wallet.refreshAction}
            loading={isRefreshingActiveSection}
            onPress={handleRefreshActiveSection}
          />
        </View>
      );
    }
  } else {
    const showSkeleton =
      isTransactionsLoading && !hasLoadedTransactions && transactions.length === 0;
    const hasFatal = Boolean(
      transactionsErrorMessage && !hasLoadedTransactions && transactions.length === 0,
    );

    if (showSkeleton) {
      listEmptyComponent = renderSkeletonCards(3);
    } else if (hasFatal) {
      listEmptyComponent = (
        <View style={styles.errorCard} accessibilityLiveRegion="polite">
          <Text style={[Typography.section, directionalText, styles.errorText]}>
            {t.wallet.transactionsLoadError}
          </Text>
          <Text style={[Typography.body, directionalText, styles.mutedText]}>
            {transactionsErrorMessage}
          </Text>
          <AppButton
            testID="marketer-transactions-retry-button"
            variant="primary"
            label={t.common.retry}
            loading={isRefreshingActiveSection}
            onPress={handleRefreshActiveSection}
          />
        </View>
      );
    } else {
      listEmptyComponent = (
        <View style={styles.emptyCard}>
          <Text style={[Typography.section, directionalText, styles.emptyTitle]}>
            {t.wallet.emptyTransactionsTitle}
          </Text>
          <Text style={[Typography.body, directionalText, styles.mutedText]}>
            {t.wallet.emptyTransactionsSubtitle}
          </Text>
          <AppButton
            variant="secondary"
            label={t.wallet.refreshAction}
            loading={isRefreshingActiveSection}
            onPress={handleRefreshActiveSection}
          />
        </View>
      );
    }
  }

  const listFooterComponent =
    activeTab !== 'stats' &&
    listData.length > 0 &&
    (activeNextPage !== null || activeLoadMoreErrorMessage) ? (
      <View style={styles.footerLoader}>
        {activeLoadMoreErrorMessage ? (
          <View style={styles.inlineErrorBanner} accessibilityLiveRegion="polite">
            <Text style={[Typography.label, directionalText, styles.errorText]}>
              {activeLoadMoreErrorMessage}
            </Text>
            <AppButton
              testID={`marketer-wallet-${activeTab}-load-more-retry-button`}
              variant="secondary"
              fullWidth={false}
              label={t.common.retry}
              loadingLabel={t.wallet.loadingMore}
              loading={activeIsLoadingMore}
              disabled={activeIsLoadingMore || isRefreshingActiveSection}
              onPress={handleRetryLoadMore}
            />
          </View>
        ) : (
          <AppButton
            testID={`marketer-wallet-${activeTab}-load-more-button`}
            variant="secondary"
            label={t.wallet.loadMore}
            loadingLabel={t.wallet.loadingMore}
            loading={activeIsLoadingMore}
            disabled={activeIsLoadingMore || isRefreshingActiveSection}
            onPress={handleLoadMore}
          />
        )}
      </View>
    ) : undefined;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <FlatList
        data={listData}
        keyExtractor={(entry) => entry.key}
        renderItem={renderListItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmptyComponent}
        ListFooterComponent={listFooterComponent}
        onEndReachedThreshold={0.35}
        onEndReached={handleLoadMore}
        refreshControl={
          <RefreshControl
            refreshing={isPullRefreshing}
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
    paddingBottom: Spacing.section,
    gap: Spacing.compact + 4,
  },
  headerStack: {
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
  balancesGroup: {
    gap: Spacing.compact + 4,
  },
  secondaryBalancesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.compact + 2,
  },
  secondaryBalanceCard: {
    flex: 1,
    minWidth: 145,
    backgroundColor: Colors.mauveTint,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.gutter,
    gap: Spacing.xs + 2,
  },
  totalEarnedCard: {
    backgroundColor: Colors.surface,
  },
  secondaryBalanceLabel: {
    color: Colors.muted,
  },
  pendingPayoutAmount: {
    color: Colors.action,
    fontFamily: FontFamily.bold,
  },
  totalEarnedAmount: {
    color: Colors.ink,
    fontFamily: FontFamily.bold,
  },
  subTabTrack: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radii.control,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.controlBorder,
    padding: Spacing.xs,
    gap: Spacing.xs,
  },
  subTabButton: {
    flex: 1,
    minHeight: TouchTarget.minHeight,
    minWidth: TouchTarget.minWidth,
    borderRadius: Radii.control - 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.compact,
  },
  subTabButtonActive: {
    backgroundColor: Colors.action,
  },
  subTabText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.ink,
    textAlign: 'center',
  },
  subTabTextActive: {
    color: Colors.onInk,
  },
  sectionHeaderRow: {
    paddingTop: Spacing.xs,
  },
  statsWrapper: {
    gap: Spacing.gutter,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.compact + 2,
  },
  statCard: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 145,
    backgroundColor: Colors.surface,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.gutter,
    gap: Spacing.xs + 2,
  },
  statValue: {
    color: Colors.ink,
  },
  statValueAccent: {
    color: Colors.action,
  },
  statValueSuccess: {
    color: Colors.success,
    fontFamily: FontFamily.bold,
  },
  reportCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.gutter,
    gap: Spacing.compact,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.compact,
  },
  shopNameText: {
    flex: 1,
    flexShrink: 1,
  },
  merchantMetricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: Spacing.compact,
    paddingTop: Spacing.xs + 2,
    borderTopWidth: BorderWidth.hairline,
    borderTopColor: Colors.rule,
  },
  merchantMetricCell: {
    gap: Spacing.xs,
    flexShrink: 1,
  },
  metricValue: {
    fontFamily: FontFamily.semiBold,
    color: Colors.ink,
  },
  txAmount: {
    fontFamily: FontFamily.bold,
  },
  positiveAmount: {
    color: Colors.success,
    fontFamily: FontFamily.bold,
  },
  debitAmount: {
    color: Colors.ink,
  },
  dangerAmount: {
    color: Colors.danger,
  },
  campaignNameText: {
    color: Colors.ink,
    fontFamily: FontFamily.semiBold,
  },
  txMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.compact,
  },
  shopSubtitle: {
    color: Colors.muted,
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
  inlineErrorBanner: {
    backgroundColor: Colors.dangerBg,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: 'rgba(152, 45, 61, 0.25)',
    padding: Spacing.gutter,
    gap: Spacing.compact,
  },
  errorText: {
    color: Colors.danger,
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
  infoPanel: {
    backgroundColor: Colors.mauveTint,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.gutter,
    gap: Spacing.gutter,
  },
  mutedText: {
    color: Colors.muted,
  },
  footerLoader: {
    paddingTop: Spacing.xs,
  },
});
