import { useIsFocused } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AppButton,
  BalanceCard,
  SkeletonBlock,
  StatusBadge,
} from '@/components/ui';
import type { StatusBadgeTone } from '@/components/ui';
import { useLocale } from '@/core/i18n';
import { useAndroidBack, useOverlayBackRegistration } from '@/core/navigation';
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
  useMarketerPayouts,
  useMarketerStats,
  useMarketerTransactions,
  useMarketerWallet,
  useRequestMarketerPayout,
} from '@/features/marketer/wallet';
import type {
  MarketerMerchantEarnings,
  MarketerPayout,
  MarketerWalletTransaction,
  MarketerWalletTransactionKind,
  PayoutStatus,
} from '@/features/marketer/wallet';

type MarketerWalletSubTab = 'stats' | 'by_merchant' | 'transactions' | 'payouts';
type PayoutStatusFilter = PayoutStatus | 'all';

type MarketerWalletListItem =
  | { type: 'merchant'; key: string; item: MarketerMerchantEarnings }
  | { type: 'transaction'; key: string; item: MarketerWalletTransaction }
  | { type: 'payout'; key: string; item: MarketerPayout };

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
  directionSign: '+' | '-';
  amountTone: 'positive' | 'debit';
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
  }
}

function getPayoutStatusTone(status: PayoutStatus): StatusBadgeTone {
  switch (status) {
    case 'pending_review':
      return 'warning';
    case 'confirmed':
      return 'success';
    case 'rejected':
      return 'danger';
  }
}

export default function MarketerWalletScreen() {
  const { locale, t } = useLocale();
  const isFocused = useIsFocused();
  const reducedMotion = useReducedMotion();
  const directionalText = getDirectionalTextStyle(locale);

  const [activeTab, setActiveTab] = useState<MarketerWalletSubTab>('stats');
  const [payoutStatusFilter, setPayoutStatusFilter] =
    useState<PayoutStatusFilter>('all');
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [payoutConfirmNotice, setPayoutConfirmNotice] = useState<string | null>(
    null,
  );
  const [alreadyPendingNotice, setAlreadyPendingNotice] = useState<string | null>(
    null,
  );
  const [dismissedCreatedPayoutId, setDismissedCreatedPayoutId] = useState<
    string | null
  >(null);

  const {
    wallet,
    availableBalanceSyp,
    pendingPayoutSyp,
    totalEarnedSyp,
    totalConfirmedPaidOutSyp,
    isLoading: isWalletLoading,
    isRefreshing: isWalletRefreshing,
    errorMessage: walletErrorMessage,
    refresh: refreshWallet,
  } = useMarketerWallet();

  const {
    isSubmitting: isSubmittingPayout,
    errorMessage: requestPayoutError,
    lastCreatedPayout,
    submitPayout,
    resetPayoutState,
  } = useRequestMarketerPayout();

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

  const {
    items: payouts,
    nextPage: payoutsNextPage,
    hasLoaded: hasLoadedPayouts,
    isLoading: isPayoutsLoading,
    isRefreshing: isPayoutsRefreshing,
    isLoadingMore: isLoadingMorePayouts,
    errorMessage: payoutsErrorMessage,
    loadMoreErrorMessage: payoutsLoadMoreErrorMessage,
    refresh: refreshPayouts,
    loadMore: loadMorePayouts,
  } = useMarketerPayouts(DEFAULT_MARKETER_WALLET_PAGE_SIZE, {
    enabled: activeTab === 'payouts',
    status: payoutStatusFilter,
  });

  const handleOpenConfirmModal = useCallback(() => {
    if (availableBalanceSyp <= 0 || pendingPayoutSyp > 0 || isSubmittingPayout) {
      return;
    }
    resetPayoutState();
    setPayoutConfirmNotice(null);
    setAlreadyPendingNotice(null);
    setIsConfirmModalOpen(true);
  }, [availableBalanceSyp, isSubmittingPayout, pendingPayoutSyp, resetPayoutState]);

  const handleDismissConfirm = useCallback((): boolean => {
    if (isSubmittingPayout) {
      return false;
    }
    setIsConfirmModalOpen(false);
    setPayoutConfirmNotice(null);
    resetPayoutState();
    return true;
  }, [isSubmittingPayout, resetPayoutState]);

  const handleRequestCloseModal = useCallback((): void => {
    handleDismissConfirm();
  }, [handleDismissConfirm]);

  useOverlayBackRegistration(
    'marketer-payout-confirm',
    isConfirmModalOpen && isFocused,
    handleDismissConfirm,
  );

  useAndroidBack({
    enabled: isFocused,
    isRootTab: true,
    isBusy: isSubmittingPayout,
  });

  const handleConfirmPayout = useCallback(async () => {
    if (isSubmittingPayout || availableBalanceSyp <= 0) {
      return;
    }
    setPayoutConfirmNotice(null);
    const result = await submitPayout(availableBalanceSyp);
    if (!result) {
      return;
    }

    if (result.ok) {
      setIsConfirmModalOpen(false);
      setPayoutConfirmNotice(null);
      setAlreadyPendingNotice(null);
      setDismissedCreatedPayoutId(null);
      return;
    }

    if (result.reason === 'amount_changed') {
      setPayoutConfirmNotice(t.wallet.payoutAmountChangedNotice);
      return;
    }

    if (result.reason === 'already_pending') {
      setIsConfirmModalOpen(false);
      setPayoutConfirmNotice(null);
      setAlreadyPendingNotice(result.errorMessage);
      setActiveTab('payouts');
      setPayoutStatusFilter('all');
    }
  }, [
    availableBalanceSyp,
    isSubmittingPayout,
    submitPayout,
    t.wallet.payoutAmountChangedNotice,
  ]);

  const subTabs = useMemo<{ key: MarketerWalletSubTab; label: string }[]>(
    () => [
      { key: 'stats', label: t.wallet.tabStats },
      { key: 'by_merchant', label: t.wallet.tabByMerchant },
      { key: 'transactions', label: t.wallet.tabTransactions },
      { key: 'payouts', label: t.wallet.tabPayouts },
    ],
    [
      t.wallet.tabByMerchant,
      t.wallet.tabPayouts,
      t.wallet.tabStats,
      t.wallet.tabTransactions,
    ],
  );

  const payoutFilterOptions = useMemo<
    { key: PayoutStatusFilter; label: string }[]
  >(
    () => [
      { key: 'all', label: t.wallet.payoutFilterAll },
      { key: 'pending_review', label: t.wallet.payoutFilterPending },
      { key: 'confirmed', label: t.wallet.payoutFilterConfirmed },
      { key: 'rejected', label: t.wallet.payoutFilterRejected },
    ],
    [
      t.wallet.payoutFilterAll,
      t.wallet.payoutFilterConfirmed,
      t.wallet.payoutFilterPending,
      t.wallet.payoutFilterRejected,
    ],
  );

  const isRefreshingActiveSection =
    activeTab === 'stats'
      ? isStatsRefreshing
      : activeTab === 'by_merchant'
        ? isByMerchantRefreshing
        : activeTab === 'transactions'
          ? isTransactionsRefreshing
          : isPayoutsRefreshing;

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
    if (activeTab === 'transactions') {
      void refreshTransactions();
      return;
    }
    void refreshPayouts();
  }, [
    activeTab,
    refreshByMerchant,
    refreshPayouts,
    refreshStats,
    refreshTransactions,
  ]);

  const handleRefresh = useCallback(() => {
    if (activeTab === 'stats') {
      void Promise.all([refreshWallet(true), refreshStats(true)]);
      return;
    }
    if (activeTab === 'by_merchant') {
      void Promise.all([refreshWallet(true), refreshByMerchant()]);
      return;
    }
    if (activeTab === 'transactions') {
      void Promise.all([refreshWallet(true), refreshTransactions()]);
      return;
    }
    void Promise.all([refreshWallet(true), refreshPayouts()]);
  }, [
    activeTab,
    refreshByMerchant,
    refreshPayouts,
    refreshStats,
    refreshTransactions,
    refreshWallet,
  ]);

  const activeNextPage =
    activeTab === 'by_merchant'
      ? byMerchantNextPage
      : activeTab === 'transactions'
        ? transactionsNextPage
        : activeTab === 'payouts'
          ? payoutsNextPage
          : null;

  const activeIsLoading =
    activeTab === 'by_merchant'
      ? isByMerchantLoading
      : activeTab === 'transactions'
        ? isTransactionsLoading
        : activeTab === 'payouts'
          ? isPayoutsLoading
          : isStatsLoading;

  const activeIsLoadingMore =
    activeTab === 'by_merchant'
      ? isLoadingMoreByMerchant
      : activeTab === 'transactions'
        ? isLoadingMoreTransactions
        : activeTab === 'payouts'
          ? isLoadingMorePayouts
          : false;

  const activeLoadMoreErrorMessage =
    activeTab === 'by_merchant'
      ? byMerchantLoadMoreErrorMessage
      : activeTab === 'transactions'
        ? transactionsLoadMoreErrorMessage
        : activeTab === 'payouts'
          ? payoutsLoadMoreErrorMessage
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
    } else if (activeTab === 'payouts') {
      void loadMorePayouts();
    }
  }, [
    activeIsLoading,
    activeIsLoadingMore,
    activeLoadMoreErrorMessage,
    activeNextPage,
    activeTab,
    isRefreshingActiveSection,
    loadMoreByMerchant,
    loadMorePayouts,
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
    } else if (activeTab === 'payouts') {
      void loadMorePayouts();
    }
  }, [
    activeIsLoading,
    activeIsLoadingMore,
    activeTab,
    isRefreshingActiveSection,
    loadMoreByMerchant,
    loadMorePayouts,
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

    if (activeTab === 'payouts') {
      const showSkeleton =
        isPayoutsLoading && !hasLoadedPayouts && payouts.length === 0;
      const hasFatal = Boolean(
        payoutsErrorMessage && !hasLoadedPayouts && payouts.length === 0,
      );
      if (showSkeleton || hasFatal) {
        return [];
      }
      return payouts.map((entry) => ({
        type: 'payout',
        key: `payout:${entry.id}`,
        item: entry,
      }));
    }

    return [];
  }, [
    activeTab,
    byMerchantErrorMessage,
    hasLoadedByMerchant,
    hasLoadedPayouts,
    hasLoadedTransactions,
    isByMerchantLoading,
    isPayoutsLoading,
    isTransactionsLoading,
    merchantEarnings,
    payouts,
    payoutsErrorMessage,
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

      if (item.type === 'transaction') {
        const tx = item.item;
        const meta = getTransactionVisualMeta(tx.kind);
        const kindLabel = t.wallet.kinds[tx.kind];
        const formattedAmount = formatSyp(tx.amountSyp, locale);
        const displayAmount = `${isolateLtr(meta.directionSign)} ${formattedAmount}`;

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
      }

      const payout = item.item;
      const statusTone = getPayoutStatusTone(payout.status);
      const statusLabel = t.wallet.payoutStatuses[payout.status];
      const formattedPayoutAmount = formatSyp(payout.amountSyp, locale);

      return (
        <View
          testID={`marketer-payout-card-${payout.id}`}
          style={styles.reportCard}
        >
          <View style={styles.cardTopRow}>
            <StatusBadge label={statusLabel} tone={statusTone} showDot />
            <Text
              style={[
                Typography.section,
                directionalText,
                TabularNumberStyle,
                styles.txAmount,
                payout.status === 'confirmed'
                  ? styles.positiveAmount
                  : payout.status === 'rejected'
                    ? styles.dangerAmount
                    : styles.pendingPayoutAmount,
              ]}
            >
              {formattedPayoutAmount}
            </Text>
          </View>

          <View style={styles.payoutDatesList}>
            <View style={styles.txMetaRow}>
              <Text style={[Typography.caption, directionalText, styles.mutedText]}>
                {t.wallet.payoutCreatedAtLabel}
              </Text>
              <Text style={[Typography.caption, directionalText, TabularNumberStyle]}>
                {formatCampaignDate(payout.createdAt, locale)}
              </Text>
            </View>

            {payout.decidedAt ? (
              <View style={styles.txMetaRow}>
                <Text style={[Typography.caption, directionalText, styles.mutedText]}>
                  {t.wallet.payoutDecidedAtLabel}
                </Text>
                <Text style={[Typography.caption, directionalText, TabularNumberStyle]}>
                  {formatCampaignDate(payout.decidedAt, locale)}
                </Text>
              </View>
            ) : payout.status === 'pending_review' ? (
              <Text style={[Typography.caption, directionalText, styles.pendingHintText]}>
                {t.wallet.payoutPendingHint}
              </Text>
            ) : null}
          </View>

          {payout.status === 'rejected' && payout.rejectionReason ? (
            <View
              testID={`marketer-payout-rejection-${payout.id}`}
              style={styles.rejectionReasonBox}
            >
              <Text style={[Typography.caption, directionalText, styles.rejectionReasonLabel]}>
                {t.wallet.payoutRejectionReasonLabel}
              </Text>
              <Text style={[Typography.body, directionalText, styles.errorText]}>
                {payout.rejectionReason}
              </Text>
            </View>
          ) : null}
        </View>
      );
    },
    [
      directionalText,
      locale,
      t.wallet.itemsSoldLabel,
      t.wallet.kinds,
      t.wallet.payoutCreatedAtLabel,
      t.wallet.payoutDecidedAtLabel,
      t.wallet.payoutPendingHint,
      t.wallet.payoutRejectionReasonLabel,
      t.wallet.payoutStatuses,
      t.wallet.salesCountLabel,
      t.wallet.totalEarnedMerchantLabel,
    ],
  );

  const hasInitialWalletError = Boolean(walletErrorMessage && !wallet);
  const showWalletBalanceSkeleton = isWalletLoading && !wallet && !hasInitialWalletError;
  const visibleCreatedPayoutBanner =
    lastCreatedPayout && dismissedCreatedPayoutId !== lastCreatedPayout.id
      ? lastCreatedPayout
      : null;

  const walletBalanceAction: ReactNode | undefined =
    showWalletBalanceSkeleton || hasInitialWalletError
      ? undefined
      : availableBalanceSyp > 0 && pendingPayoutSyp === 0
        ? (
            <AppButton
              testID="marketer-request-payout-button"
              variant="primary"
              label={t.wallet.requestPayoutAction}
              onPress={handleOpenConfirmModal}
            />
          )
        : pendingPayoutSyp > 0
          ? (
              <View
                testID="wallet-pending-payout-notice"
                style={styles.pendingActionNoticeBox}
                accessible
                accessibilityLiveRegion="polite"
              >
                <StatusBadge
                  label={t.wallet.payoutStatuses.pending_review}
                  tone="warning"
                  showDot
                />
                <Text
                  style={[
                    Typography.label,
                    directionalText,
                    TabularNumberStyle,
                    styles.pendingActionNoticeText,
                  ]}
                >
                  {`${t.wallet.payoutPendingNotice} ${formatSyp(pendingPayoutSyp, locale)}`}
                </Text>
              </View>
            )
          : (
              <View style={styles.zeroBalanceActionGroup}>
                <AppButton
                  testID="marketer-request-payout-button"
                  variant="secondary"
                  disabled
                  label={t.wallet.requestPayoutAction}
                  onPress={handleOpenConfirmModal}
                />
                <Text
                  testID="wallet-zero-balance-hint"
                  style={[Typography.caption, directionalText, styles.zeroBalanceHintText]}
                >
                  {t.wallet.payoutZeroBalanceHint}
                </Text>
              </View>
            );

  const sectionTitle =
    activeTab === 'stats'
      ? t.wallet.statsTitle
      : activeTab === 'by_merchant'
        ? t.wallet.byMerchantTitle
        : activeTab === 'transactions'
          ? t.wallet.transactionsTitle
          : t.wallet.payoutsTitle;

  const activeInlineError =
    activeTab === 'by_merchant' &&
    byMerchantErrorMessage &&
    (hasLoadedByMerchant || merchantEarnings.length > 0)
      ? byMerchantErrorMessage
      : activeTab === 'transactions' &&
          transactionsErrorMessage &&
          (hasLoadedTransactions || transactions.length > 0)
        ? transactionsErrorMessage
        : activeTab === 'payouts' &&
            payoutsErrorMessage &&
            (hasLoadedPayouts || payouts.length > 0)
          ? payoutsErrorMessage
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

      {visibleCreatedPayoutBanner ? (
        <View
          testID="marketer-payout-created-banner"
          style={styles.successBanner}
          accessibilityLiveRegion="polite"
        >
          <View style={styles.bannerTopRow}>
            <StatusBadge
              label={t.wallet.payoutStatuses[visibleCreatedPayoutBanner.status]}
              tone={getPayoutStatusTone(visibleCreatedPayoutBanner.status)}
              showDot
            />
            <Pressable
              testID="marketer-payout-banner-dismiss-button"
              onPress={() =>
                setDismissedCreatedPayoutId(visibleCreatedPayoutBanner.id)
              }
              accessibilityRole="button"
              accessibilityLabel={t.common.confirm}
              style={styles.bannerDismissButton}
            >
              <Text style={styles.bannerDismissText}>{'×'}</Text>
            </Pressable>
          </View>

          <Text style={[Typography.label, directionalText, styles.successText]}>
            {t.wallet.payoutCreatedBanner}
          </Text>

          <View style={styles.bannerFooterRow}>
            <Text
              style={[
                Typography.section,
                directionalText,
                TabularNumberStyle,
                styles.successAmountText,
              ]}
            >
              {formatSyp(visibleCreatedPayoutBanner.amountSyp, locale)}
            </Text>
            {activeTab !== 'payouts' ? (
              <AppButton
                testID="marketer-payout-banner-view-payouts-button"
                variant="secondary"
                fullWidth={false}
                label={t.wallet.tabPayouts}
                onPress={() => {
                  setActiveTab('payouts');
                  setPayoutStatusFilter('all');
                }}
              />
            ) : null}
          </View>
        </View>
      ) : null}

      {alreadyPendingNotice ? (
        <View
          testID="marketer-payout-already-pending-banner"
          style={styles.warningBanner}
          accessibilityLiveRegion="polite"
        >
          <Text style={[Typography.label, directionalText, styles.warningBannerText]}>
            {alreadyPendingNotice}
          </Text>
        </View>
      ) : null}

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
            action={walletBalanceAction}
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

            <View
              testID="wallet-confirmed-paid-out-card"
              style={[styles.secondaryBalanceCard, styles.confirmedPaidOutCard]}
              accessible
              accessibilityRole="summary"
              accessibilityLabel={
                showWalletBalanceSkeleton
                  ? t.wallet.totalConfirmedPaidOut
                  : `${t.wallet.totalConfirmedPaidOut}: ${formatSyp(totalConfirmedPaidOutSyp, locale)}`
              }
            >
              <Text style={[Typography.label, directionalText, styles.secondaryBalanceLabel]}>
                {t.wallet.totalConfirmedPaidOut}
              </Text>
              {showWalletBalanceSkeleton ? (
                <SkeletonBlock width="78%" height={24} borderRadius={Radii.control} />
              ) : (
                <Text
                  style={[
                    Typography.section,
                    directionalText,
                    TabularNumberStyle,
                    styles.confirmedPaidOutAmount,
                  ]}
                >
                  {formatSyp(totalConfirmedPaidOutSyp, locale)}
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

      {activeTab === 'payouts' ? (
        <View
          style={styles.payoutFilterTrack}
          accessibilityRole="tablist"
          accessibilityLabel={t.wallet.payoutsTitle}
        >
          {payoutFilterOptions.map((option) => {
            const selected = payoutStatusFilter === option.key;
            return (
              <Pressable
                key={option.key}
                testID={`marketer-payout-filter-${option.key}`}
                onPress={() => setPayoutStatusFilter(option.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={option.label}
                style={[
                  styles.payoutFilterButton,
                  selected ? styles.payoutFilterButtonActive : null,
                ]}
              >
                <Text
                  style={[
                    styles.payoutFilterText,
                    selected ? styles.payoutFilterTextActive : null,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

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
  } else if (activeTab === 'transactions') {
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
  } else {
    const showSkeleton =
      isPayoutsLoading && !hasLoadedPayouts && payouts.length === 0;
    const hasFatal = Boolean(
      payoutsErrorMessage && !hasLoadedPayouts && payouts.length === 0,
    );

    if (showSkeleton) {
      listEmptyComponent = renderSkeletonCards(3);
    } else if (hasFatal) {
      listEmptyComponent = (
        <View style={styles.errorCard} accessibilityLiveRegion="polite">
          <Text style={[Typography.section, directionalText, styles.errorText]}>
            {t.wallet.payoutsLoadError}
          </Text>
          <Text style={[Typography.body, directionalText, styles.mutedText]}>
            {payoutsErrorMessage}
          </Text>
          <AppButton
            testID="marketer-payouts-retry-button"
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
            {t.wallet.emptyPayoutsTitle}
          </Text>
          <Text style={[Typography.body, directionalText, styles.mutedText]}>
            {t.wallet.emptyPayoutsSubtitle}
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

  const isConfirmButtonDisabled = isSubmittingPayout || availableBalanceSyp <= 0;

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

      <Modal
        visible={isConfirmModalOpen}
        transparent
        animationType={reducedMotion ? 'none' : 'fade'}
        onRequestClose={handleRequestCloseModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard} accessibilityViewIsModal>
            <Text style={[Typography.section, directionalText]}>
              {t.wallet.payoutConfirmTitle}
            </Text>
            <Text style={[Typography.body, directionalText, styles.mutedText]}>
              {t.wallet.payoutConfirmMessage}
            </Text>

            <View style={styles.modalAmountBox}>
              <Text style={[Typography.caption, directionalText, styles.mutedText]}>
                {t.wallet.payoutConfirmAmountLabel}
              </Text>
              <Text
                testID="marketer-payout-confirm-amount"
                style={[
                  Typography.balance,
                  directionalText,
                  TabularNumberStyle,
                  styles.modalAmountValue,
                ]}
              >
                {formatSyp(availableBalanceSyp, locale)}
              </Text>
            </View>

            {payoutConfirmNotice ? (
              <View
                testID="marketer-payout-amount-changed-notice"
                style={styles.warningBanner}
                accessibilityLiveRegion="polite"
              >
                <Text
                  style={[Typography.label, directionalText, styles.warningBannerText]}
                >
                  {payoutConfirmNotice}
                </Text>
              </View>
            ) : requestPayoutError ? (
              <View
                testID="marketer-payout-confirm-error"
                style={styles.inlineErrorBanner}
                accessibilityLiveRegion="polite"
              >
                <Text style={[Typography.label, directionalText, styles.errorText]}>
                  {requestPayoutError}
                </Text>
              </View>
            ) : null}

            {availableBalanceSyp <= 0 ? (
              <Text style={[Typography.caption, directionalText, styles.errorText]}>
                {t.wallet.payoutZeroBalanceHint}
              </Text>
            ) : null}

            <View style={styles.modalActions}>
              <AppButton
                testID="marketer-payout-confirm-submit-button"
                variant="primary"
                label={t.wallet.payoutConfirmAction}
                loadingLabel={t.wallet.requestingPayoutAction}
                loading={isSubmittingPayout}
                disabled={isConfirmButtonDisabled}
                haptic="medium"
                onPress={() => void handleConfirmPayout()}
              />
              <AppButton
                testID="marketer-payout-confirm-cancel-button"
                variant="secondary"
                label={t.common.cancel}
                disabled={isSubmittingPayout}
                onPress={handleRequestCloseModal}
              />
            </View>
          </View>
        </View>
      </Modal>
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
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '46%',
    minWidth: 136,
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
  confirmedPaidOutCard: {
    backgroundColor: Colors.successBg,
    borderColor: 'rgba(49, 93, 71, 0.22)',
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
  confirmedPaidOutAmount: {
    color: Colors.success,
    fontFamily: FontFamily.bold,
  },
  pendingActionNoticeBox: {
    backgroundColor: Colors.warningBg,
    borderRadius: Radii.control,
    borderWidth: BorderWidth.hairline,
    borderColor: 'rgba(120, 69, 26, 0.25)',
    padding: Spacing.compact + 4,
    gap: Spacing.compact,
  },
  pendingActionNoticeText: {
    color: Colors.warning,
  },
  zeroBalanceActionGroup: {
    gap: Spacing.compact,
  },
  zeroBalanceHintText: {
    color: 'rgba(255, 255, 255, 0.86)',
  },
  subTabTrack: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: Colors.surface,
    borderRadius: Radii.control,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.controlBorder,
    padding: Spacing.xs,
    gap: Spacing.xs,
  },
  subTabButton: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '46%',
    minHeight: TouchTarget.minHeight,
    minWidth: 120,
    borderRadius: Radii.control - 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.compact,
    paddingVertical: Spacing.xs,
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
  payoutFilterTrack: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.compact,
  },
  payoutFilterButton: {
    flexGrow: 1,
    minHeight: TouchTarget.minHeight,
    minWidth: TouchTarget.minWidth,
    backgroundColor: Colors.surface,
    borderRadius: Radii.control,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.controlBorder,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.compact + 4,
    paddingVertical: Spacing.xs,
  },
  payoutFilterButtonActive: {
    backgroundColor: Colors.ink,
    borderColor: Colors.ink,
  },
  payoutFilterText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.ink,
    textAlign: 'center',
  },
  payoutFilterTextActive: {
    color: Colors.onInk,
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
  successBanner: {
    backgroundColor: Colors.successBg,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: 'rgba(49, 93, 71, 0.25)',
    padding: Spacing.gutter,
    gap: Spacing.compact,
  },
  bannerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.compact,
  },
  bannerDismissButton: {
    minWidth: TouchTarget.minWidth,
    minHeight: TouchTarget.minHeight,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.control,
  },
  bannerDismissText: {
    fontFamily: FontFamily.bold,
    fontSize: 22,
    lineHeight: 24,
    color: Colors.success,
  },
  successText: {
    color: Colors.success,
  },
  successAmountText: {
    color: Colors.success,
    fontFamily: FontFamily.bold,
  },
  bannerFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.compact,
  },
  warningBanner: {
    backgroundColor: Colors.warningBg,
    borderRadius: Radii.control,
    borderWidth: BorderWidth.hairline,
    borderColor: 'rgba(120, 69, 26, 0.25)',
    padding: Spacing.compact + 4,
  },
  warningBannerText: {
    color: Colors.warning,
  },
  payoutDatesList: {
    gap: Spacing.xs + 2,
    paddingTop: Spacing.xs,
    borderTopWidth: BorderWidth.hairline,
    borderTopColor: Colors.rule,
  },
  pendingHintText: {
    color: Colors.warning,
  },
  rejectionReasonBox: {
    backgroundColor: Colors.dangerBg,
    borderRadius: Radii.control,
    borderWidth: BorderWidth.hairline,
    borderColor: 'rgba(152, 45, 61, 0.25)',
    padding: Spacing.compact + 4,
    gap: Spacing.xs,
  },
  rejectionReasonLabel: {
    color: Colors.danger,
    fontFamily: FontFamily.semiBold,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(80, 60, 68, 0.56)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.gutter,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.section,
    gap: Spacing.gutter,
  },
  modalAmountBox: {
    backgroundColor: Colors.mauveTint,
    borderRadius: Radii.control,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.gutter,
    gap: Spacing.xs,
  },
  modalAmountValue: {
    color: Colors.ink,
  },
  modalActions: {
    gap: Spacing.compact + 4,
  },
});
