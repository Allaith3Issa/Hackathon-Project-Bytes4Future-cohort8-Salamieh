import { useIsFocused, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useCallback } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AppButton,
  AppInput,
  CampaignCard,
  CampaignCardSkeleton,
  StatusBadge,
} from '@/components/ui';
import type { StatusBadgeTone } from '@/components/ui';
import { useLocale } from '@/core/i18n';
import { useAndroidBack } from '@/core/navigation';
import { getDirectionalTextStyle } from '@/core/rtl';
import {
  BorderWidth,
  Colors,
  Radii,
  Spacing,
  TouchTarget,
  Typography,
} from '@/core/theme';
import { useCampaignsFeed } from '@/features/marketer/campaigns';
import type { CampaignViewModel } from '@/features/marketer/campaigns';

function resolveCampaignBadge(
  item: CampaignViewModel,
  labels: { joined: string; active: string; ended: string },
): { label: string; tone: StatusBadgeTone } {
  if (item.membership?.status === 'approved') {
    return { label: labels.joined, tone: 'success' };
  }
  if (item.campaign.status === 'ended') {
    return { label: labels.ended, tone: 'info' };
  }
  return { label: labels.active, tone: 'mauve' };
}

export default function CampaignsBrowseScreen() {
  const { locale, t } = useLocale();
  const router = useRouter();
  const isFocused = useIsFocused();

  const {
    items,
    nextPage,
    hasAnyCampaigns,
    isLoading,
    isRefreshing,
    isLoadingMore,
    errorMessage,
    loadMoreErrorMessage,
    searchQuery,
    setSearchQuery,
    refresh,
    loadMore,
  } = useCampaignsFeed();

  useAndroidBack({
    enabled: isFocused,
    isRootTab: true,
  });

  const directionalText = getDirectionalTextStyle(locale);

  const handleRefresh = useCallback(() => {
    void refresh(true);
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

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, [setSearchQuery]);

  const handleOpenCampaign = useCallback(
    (campaignId: string) => {
      router.push(`/marketer/campaigns/${campaignId}` as Href);
    },
    [router],
  );

  const renderCampaignItem = useCallback(
    ({ item, index }: { item: CampaignViewModel; index: number }) => {
      const { campaign } = item;
      const badge = resolveCampaignBadge(item, {
        joined: t.campaigns.joinedStatus,
        active: t.campaigns.activeStatus,
        ended: t.campaigns.endedStatus,
      });

      const commissionAmountSyp =
        campaign.commission.type === 'fixed'
          ? campaign.commission.amountSyp
          : campaign.commissionPerItemSyp;
      const commissionPercent =
        campaign.commission.type === 'percentage'
          ? campaign.commission.percent
          : null;

      return (
        <CampaignCard
          testID={`campaign-card-${campaign.id}`}
          index={index}
          shopName={campaign.shopName}
          productName={campaign.productName}
          imageUrl={campaign.imageUrl}
          originalPriceSyp={campaign.originalPriceSyp}
          finalPriceSyp={campaign.finalPriceSyp}
          discountPercent={campaign.discountPercent}
          commissionAmountSyp={commissionAmountSyp}
          commissionPercent={commissionPercent}
          endsAt={campaign.endsAt}
          statusLabel={badge.label}
          statusTone={badge.tone}
          onPress={() => handleOpenCampaign(campaign.id)}
        />
      );
    },
    [
      handleOpenCampaign,
      t.campaigns.activeStatus,
      t.campaigns.endedStatus,
      t.campaigns.joinedStatus,
    ],
  );

  const hasSearchFilter = searchQuery.trim().length > 0;

  const listFooterComponent =
    items.length > 0 && (nextPage !== null || loadMoreErrorMessage) ? (
      <View style={styles.footerLoader}>
        {loadMoreErrorMessage ? (
          <View style={styles.inlineErrorBanner} accessibilityLiveRegion="polite">
            <Text style={[Typography.label, directionalText, styles.errorTitle]}>
              {loadMoreErrorMessage}
            </Text>
            <AppButton
              testID="campaigns-load-more-retry-button"
              variant="secondary"
              fullWidth={false}
              label={t.common.retry}
              loadingLabel={t.campaigns.loadingMore}
              loading={isLoadingMore}
              disabled={isLoadingMore || isRefreshing}
              onPress={handleRetryLoadMore}
            />
          </View>
        ) : (
          <AppButton
            testID="campaigns-load-more-button"
            variant="secondary"
            label={t.campaigns.loadMore}
            loadingLabel={t.campaigns.loadingMore}
            loading={isLoadingMore}
            disabled={isLoadingMore || isRefreshing}
            onPress={handleLoadMore}
          />
        )}
      </View>
    ) : undefined;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.headerBlock}>
        <View style={styles.titleRow}>
          <Text style={[Typography.display, directionalText, styles.titleText]}>
            {t.campaigns.screenTitle}
          </Text>
          <StatusBadge label={t.profile.roleMarketer} tone="mauve" />
        </View>

        <AppInput
          testID="campaigns-search-input"
          placeholder={t.campaigns.searchPlaceholder}
          accessibilityLabel={t.campaigns.searchPlaceholder}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          autoCorrect={false}
          endAccessory={
            hasSearchFilter ? (
              <Pressable
                onPress={handleClearSearch}
                accessibilityRole="button"
                accessibilityLabel={t.campaigns.clearSearch}
                style={styles.clearButton}
              >
                <Text style={[Typography.label, styles.clearButtonText]}>×</Text>
              </Pressable>
            ) : null
          }
        />
      </View>

      {isLoading && !hasAnyCampaigns ? (
        <ScrollView
          contentContainerStyle={styles.scrollListContent}
          showsVerticalScrollIndicator={false}
        >
          <CampaignCardSkeleton />
          <CampaignCardSkeleton />
          <CampaignCardSkeleton />
        </ScrollView>
      ) : errorMessage && !hasAnyCampaigns ? (
        <ScrollView
          contentContainerStyle={styles.stateContainer}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.action}
              colors={[Colors.action]}
            />
          }
        >
          <View style={styles.errorCard}>
            <Text style={[Typography.section, directionalText, styles.errorTitle]}>
              {t.campaigns.loadError}
            </Text>
            <Text style={[Typography.body, directionalText, styles.mutedText]}>
              {errorMessage}
            </Text>
            <AppButton
              testID="campaigns-retry-button"
              variant="primary"
              label={t.common.retry}
              loading={isRefreshing}
              onPress={handleRefresh}
            />
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.campaign.id}
          renderItem={renderCampaignItem}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={
            items.length === 0 ? styles.emptyListContent : styles.scrollListContent
          }
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
          ListHeaderComponent={
            errorMessage ? (
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
            ) : undefined
          }
          ListFooterComponent={listFooterComponent}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={[Typography.section, directionalText, styles.emptyTitle]}>
                {hasSearchFilter
                  ? t.campaigns.emptySearchTitle
                  : t.campaigns.emptyTitle}
              </Text>
              {!hasSearchFilter ? (
                <Text style={[Typography.body, directionalText, styles.mutedText]}>
                  {t.campaigns.emptySubtitle}
                </Text>
              ) : null}
              <AppButton
                variant={hasSearchFilter ? 'secondary' : 'primary'}
                label={
                  hasSearchFilter ? t.campaigns.clearSearch : t.campaigns.refreshList
                }
                loading={!hasSearchFilter && isRefreshing}
                onPress={hasSearchFilter ? handleClearSearch : handleRefresh}
              />
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  headerBlock: {
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
  clearButton: {
    minWidth: TouchTarget.minWidth,
    minHeight: TouchTarget.minHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButtonText: {
    fontSize: 22,
    lineHeight: 24,
    color: Colors.muted,
  },
  scrollListContent: {
    paddingHorizontal: Spacing.gutter,
    paddingTop: Spacing.gutter,
    paddingBottom: Spacing.section,
    gap: Spacing.gutter,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.gutter,
    paddingVertical: Spacing.section,
  },
  stateContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.gutter,
    paddingVertical: Spacing.section,
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
    paddingBottom: Spacing.compact,
  },
});
