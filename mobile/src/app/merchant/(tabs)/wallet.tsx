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
  formatSyp,
  getDirectionalTextStyle,
  isolateLtr,
} from '@/core/rtl';
import { BorderWidth, Colors, FontFamily, Radii, Spacing, Typography } from '@/core/theme';
import {
  useMerchantTransactions,
  useMerchantWallet,
} from '@/features/merchant/wallet';
import type {
  MerchantWalletTransaction,
  MerchantWalletTransactionKind,
} from '@/features/merchant/wallet';

function getTransactionVisualMeta(kind: MerchantWalletTransactionKind): {
  tone: StatusBadgeTone;
  directionSign: '+' | '-';
  isPositiveFlow: boolean;
} {
  switch (kind) {
    case 'merchant_topup':
    case 'cashback_voucher_merchant_credit':
      return { tone: 'success', directionSign: '+', isPositiveFlow: true };
    case 'campaign_reserve_unlock':
      return { tone: 'info', directionSign: '+', isPositiveFlow: true };
    case 'campaign_reserve_lock':
      return { tone: 'mauve', directionSign: '-', isPositiveFlow: false };
    case 'sale_reserve_debit':
      return { tone: 'action', directionSign: '-', isPositiveFlow: false };
  }
}

export default function MerchantWalletScreen() {
  const { locale, t } = useLocale();
  const isFocused = useIsFocused();
  const directionalText = getDirectionalTextStyle(locale);

  const {
    wallet,
    availableBalanceSyp,
    totalLockedReservesSyp,
    creditLimitSyp,
    isLoading: isWalletLoading,
    isRefreshing: isWalletRefreshing,
    errorMessage: walletErrorMessage,
    refresh: refreshWallet,
  } = useMerchantWallet();

  const {
    items: transactions,
    nextPage,
    hasLoaded: hasLoadedTransactions,
    isLoading: isTransactionsLoading,
    isRefreshing: isTransactionsRefreshing,
    isLoadingMore,
    errorMessage: transactionsErrorMessage,
    refresh: refreshTransactions,
    loadMore,
  } = useMerchantTransactions();

  useAndroidBack({
    enabled: isFocused,
    isRootTab: true,
  });

  const isRefreshingAll = isWalletRefreshing || isTransactionsRefreshing;

  const handleRefreshAll = useCallback(() => {
    void Promise.all([refreshWallet(true), refreshTransactions()]);
  }, [refreshTransactions, refreshWallet]);

  const handleLoadMore = useCallback(() => {
    if (nextPage !== null && !isLoadingMore && !isTransactionsLoading && !isRefreshingAll) {
      void loadMore();
    }
  }, [isLoadingMore, isRefreshingAll, isTransactionsLoading, loadMore, nextPage]);

  const renderTransactionItem = useCallback(
    ({ item }: { item: MerchantWalletTransaction }) => {
      const meta = getTransactionVisualMeta(item.kind);
      const kindLabel = t.merchant.wallet.kinds[item.kind];
      const formattedAmount = formatSyp(item.amountSyp, locale);
      const signedAmount = `${isolateLtr(meta.directionSign)} ${formattedAmount}`;

      return (
        <View
          testID={`merchant-wallet-tx-${item.id}`}
          style={styles.txCard}
          accessible
          accessibilityLabel={`${kindLabel} ${signedAmount}`}
        >
          <View style={styles.txTopRow}>
            <StatusBadge label={kindLabel} tone={meta.tone} showDot />
            <Text
              style={[
                Typography.section,
                directionalText,
                styles.txAmount,
                meta.isPositiveFlow ? styles.txPositiveAmount : styles.txDebitAmount,
              ]}
            >
              {signedAmount}
            </Text>
          </View>

          {item.campaignName ? (
            <Text style={[Typography.body, directionalText, styles.txCampaignName]}>
              {item.campaignName}
            </Text>
          ) : null}

          <View style={styles.txMetaRow}>
            <Text style={[Typography.caption, directionalText]}>
              {formatCampaignDate(item.createdAt, locale)}
            </Text>
            {item.referenceNote ? (
              <Text
                selectable
                style={[Typography.caption, directionalText, styles.txReferenceNote]}
              >
                {`${t.merchant.wallet.noteReferenceLabel}: ${isolateLtr(item.referenceNote)}`}
              </Text>
            ) : null}
          </View>
        </View>
      );
    },
    [directionalText, locale, t.merchant.wallet.kinds, t.merchant.wallet.noteReferenceLabel],
  );

  const hasFatalWalletError = Boolean(walletErrorMessage && !wallet);
  const hasFatalTransactionsError = Boolean(
    transactionsErrorMessage && !hasLoadedTransactions && transactions.length === 0,
  );
  const showInitialSkeleton =
    (isTransactionsLoading && !hasLoadedTransactions && transactions.length === 0) ||
    (isWalletLoading && !wallet && !hasFatalWalletError);

  const listHeader = (
    <View style={styles.headerStack}>
      <View style={styles.titleRow}>
        <Text style={[Typography.display, directionalText, styles.titleText]}>
          {t.merchant.wallet.screenTitle}
        </Text>
        <StatusBadge label={t.profile.roleMerchant} tone="mauve" />
      </View>

      {hasFatalWalletError ? (
        <View style={styles.errorCard} accessibilityLiveRegion="polite">
          <Text style={[Typography.section, directionalText, styles.errorTitle]}>
            {t.merchant.wallet.loadError}
          </Text>
          <Text style={[Typography.body, directionalText, styles.mutedText]}>
            {walletErrorMessage}
          </Text>
          <AppButton
            testID="merchant-wallet-retry-button"
            variant="primary"
            label={t.common.retry}
            loading={isRefreshingAll}
            onPress={handleRefreshAll}
          />
        </View>
      ) : (
        <View style={styles.balanceCardsStack}>
          <BalanceCard
            testID="merchant-wallet-available-card"
            variant="primary"
            label={t.merchant.wallet.availableBalance}
            amountSyp={availableBalanceSyp}
            hint={t.merchant.wallet.availableBalanceHint}
            loading={isWalletLoading && !wallet}
          />

          <BalanceCard
            testID="merchant-wallet-locked-card"
            variant="secondary"
            label={t.merchant.wallet.lockedReserves}
            amountSyp={totalLockedReservesSyp}
            hint={
              creditLimitSyp > 0
                ? `${t.merchant.wallet.lockedReservesHint} (${t.merchant.wallet.creditLimitLabel}: ${formatSyp(creditLimitSyp, locale)})`
                : t.merchant.wallet.lockedReservesHint
            }
            loading={isWalletLoading && !wallet}
          />

          {walletErrorMessage ? (
            <View style={styles.inlineErrorBanner} accessibilityLiveRegion="polite">
              <Text style={[Typography.label, directionalText, styles.errorTitle]}>
                {walletErrorMessage}
              </Text>
            </View>
          ) : null}
        </View>
      )}

      <View style={styles.sectionHeaderRow}>
        <Text style={[Typography.section, directionalText]}>
          {t.merchant.wallet.transactionsTitle}
        </Text>
      </View>

      {transactionsErrorMessage && (hasLoadedTransactions || transactions.length > 0) ? (
        <View style={styles.inlineErrorBanner} accessibilityLiveRegion="polite">
          <Text style={[Typography.label, directionalText, styles.errorTitle]}>
            {transactionsErrorMessage}
          </Text>
          <AppButton
            variant="secondary"
            fullWidth={false}
            label={t.common.retry}
            loading={isRefreshingAll}
            onPress={handleRefreshAll}
          />
        </View>
      ) : null}
    </View>
  );

  const listEmptyComponent = showInitialSkeleton ? (
    <View style={styles.skeletonStack}>
      <View style={styles.skeletonCard}>
        <View style={styles.skeletonRow}>
          <SkeletonBlock width={120} height={24} />
          <SkeletonBlock width={90} height={22} />
        </View>
        <SkeletonBlock width="70%" height={18} />
        <SkeletonBlock width="40%" height={14} />
      </View>
      <View style={styles.skeletonCard}>
        <View style={styles.skeletonRow}>
          <SkeletonBlock width={140} height={24} />
          <SkeletonBlock width={84} height={22} />
        </View>
        <SkeletonBlock width="60%" height={18} />
        <SkeletonBlock width="35%" height={14} />
      </View>
      <View style={styles.skeletonCard}>
        <View style={styles.skeletonRow}>
          <SkeletonBlock width={110} height={24} />
          <SkeletonBlock width={96} height={22} />
        </View>
        <SkeletonBlock width="55%" height={14} />
      </View>
    </View>
  ) : hasFatalTransactionsError ? (
    <View style={styles.errorCard} accessibilityLiveRegion="polite">
      <Text style={[Typography.section, directionalText, styles.errorTitle]}>
        {t.merchant.wallet.transactionsLoadError}
      </Text>
      <Text style={[Typography.body, directionalText, styles.mutedText]}>
        {transactionsErrorMessage}
      </Text>
      <AppButton
        testID="merchant-transactions-retry-button"
        variant="primary"
        label={t.common.retry}
        loading={isRefreshingAll}
        onPress={handleRefreshAll}
      />
    </View>
  ) : (
    <View style={styles.emptyCard}>
      <Text style={[Typography.section, directionalText, styles.emptyTitle]}>
        {t.merchant.wallet.emptyTitle}
      </Text>
      <Text style={[Typography.body, directionalText, styles.mutedText]}>
        {t.merchant.wallet.emptySubtitle}
      </Text>
      <AppButton
        variant="secondary"
        label={t.merchant.wallet.refreshAction}
        loading={isRefreshingAll}
        onPress={handleRefreshAll}
      />
    </View>
  );

  const listFooterComponent =
    nextPage !== null ? (
      <View style={styles.footerLoader}>
        <AppButton
          testID="merchant-wallet-load-more-button"
          variant="secondary"
          label={t.merchant.wallet.loadMore}
          loadingLabel={t.merchant.wallet.loadingMore}
          loading={isLoadingMore}
          disabled={isLoadingMore || isRefreshingAll}
          onPress={handleLoadMore}
        />
      </View>
    ) : undefined;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <FlatList
        data={showInitialSkeleton || hasFatalTransactionsError ? [] : transactions}
        keyExtractor={(item) => item.id}
        renderItem={renderTransactionItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmptyComponent}
        ListFooterComponent={listFooterComponent}
        onEndReachedThreshold={0.35}
        onEndReached={handleLoadMore}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshingAll}
            onRefresh={handleRefreshAll}
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
  balanceCardsStack: {
    gap: Spacing.compact + 4,
  },
  sectionHeaderRow: {
    paddingTop: Spacing.xs,
  },
  txCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.gutter,
    gap: Spacing.compact,
  },
  txTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.compact,
  },
  txAmount: {
    fontFamily: FontFamily.bold,
  },
  txPositiveAmount: {
    color: Colors.success,
  },
  txDebitAmount: {
    color: Colors.ink,
  },
  txCampaignName: {
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
  txReferenceNote: {
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
    paddingTop: Spacing.compact,
  },
});
