import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, SkeletonBlock, StatusBadge } from '@/components/ui';
import { isSafeHttpUrl, sanitizeImageUrl } from '@/core/api';
import { useLocale } from '@/core/i18n';
import { useAndroidBack, useOverlayBackRegistration } from '@/core/navigation';
import {
  formatCampaignDate,
  formatPercent,
  formatSyp,
  getDirectionalTextStyle,
  getMirrorTransform,
  LtrTextStyle,
} from '@/core/rtl';
import {
  BorderWidth,
  Colors,
  FontFamily,
  Radii,
  Spacing,
  TouchTarget,
  Typography,
} from '@/core/theme';
import { useMerchantCampaignDetail } from '@/features/merchant/campaigns';

function getShopMonogram(shopName: string): string {
  const trimmed = shopName.trim();
  if (!trimmed) {
    return 'م';
  }
  return Array.from(trimmed)[0] ?? 'م';
}

export default function MerchantCampaignDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const campaignId = Array.isArray(id) ? (id[0] ?? '') : (id ?? '');

  const router = useRouter();
  const isFocused = useIsFocused();
  const { locale, t } = useLocale();
  const reducedMotion = useReducedMotion();

  const {
    campaign,
    isLoading,
    isRefreshing,
    isClosing,
    justClosed,
    errorMessage,
    closeError,
    refresh,
    closeCampaign,
  } = useMerchantCampaignDetail(campaignId);

  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const [hasCopiedDirectLink, setHasCopiedDirectLink] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDismissConfirm = useCallback((): boolean => {
    if (isClosing) {
      return false;
    }
    setIsConfirmModalOpen(false);
    return true;
  }, [isClosing]);

  useOverlayBackRegistration(
    `merchant-close-campaign-${campaignId}`,
    isConfirmModalOpen && isFocused,
    handleDismissConfirm,
  );

  useAndroidBack({
    enabled: isFocused,
    isBusy: isClosing,
    isRootTab: false,
  });

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const handleGoBack = useCallback(() => {
    if (isClosing) {
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/merchant/campaigns' as Href);
    }
  }, [isClosing, router]);

  const handleRefresh = useCallback(() => {
    void refresh(true);
  }, [refresh]);

  const handleConfirmClose = useCallback(async () => {
    if (isClosing) {
      return;
    }
    const closed = await closeCampaign();
    if (closed) {
      setIsConfirmModalOpen(false);
    }
  }, [closeCampaign, isClosing]);

  const safeImageUrl = sanitizeImageUrl(campaign?.imageUrl);
  const showImageFallback = !safeImageUrl || failedImageUrl === safeImageUrl;

  const validatedDirectReferralUrl = isSafeHttpUrl(campaign?.directReferralUrl)
    ? campaign.directReferralUrl.trim()
    : null;

  const handleShareDirectLink = useCallback(async () => {
    if (!campaign || !validatedDirectReferralUrl) {
      setShareError(t.campaigns.invalidReferralUrl);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => undefined,
      );
      return;
    }

    setShareError(null);
    const shareMessage = `${t.campaigns.shareMessagePrefix} ${campaign.productName} - ${campaign.shopName}\n${validatedDirectReferralUrl}`;

    try {
      const result = await Share.share({
        title: campaign.productName,
        message: shareMessage,
        url: validatedDirectReferralUrl,
      });

      if (result.action === Share.sharedAction) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => undefined,
        );
      }
    } catch {
      setShareError(t.campaigns.invalidReferralUrl);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => undefined,
      );
    }
  }, [campaign, t.campaigns.invalidReferralUrl, t.campaigns.shareMessagePrefix, validatedDirectReferralUrl]);

  const handleCopyDirectLink = useCallback(async () => {
    if (!validatedDirectReferralUrl) {
      return;
    }

    await Clipboard.setStringAsync(validatedDirectReferralUrl);
    setHasCopiedDirectLink(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => undefined,
    );

    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = setTimeout(() => {
      setHasCopiedDirectLink(false);
    }, 2200);
  }, [validatedDirectReferralUrl]);

  const directionalText = getDirectionalTextStyle(locale);

  const commissionDisplay = campaign
    ? campaign.commission.type === 'fixed'
      ? formatSyp(campaign.commission.amountSyp, locale)
      : campaign.commissionPerItemSyp !== null
        ? formatSyp(campaign.commissionPerItemSyp, locale)
        : formatPercent(campaign.commission.percent, locale)
    : '';

  const statsItems = campaign
    ? [
        {
          key: 'clicks',
          label: t.merchant.dashboard.clicksLabel,
          value: String(campaign.stats.clicks),
        },
        {
          key: 'salesCount',
          label: t.merchant.dashboard.salesCountLabel,
          value: String(campaign.stats.salesCount),
        },
        {
          key: 'itemsSold',
          label: t.merchant.dashboard.itemsSoldLabel,
          value: String(campaign.stats.itemsSold),
        },
        {
          key: 'grossCashSalesSyp',
          label: t.merchant.dashboard.grossSalesLabel,
          value: formatSyp(campaign.stats.grossCashSalesSyp, locale),
        },
        {
          key: 'commissionPaidSyp',
          label: t.merchant.dashboard.commissionsPaidLabel,
          value: formatSyp(campaign.stats.commissionPaidSyp, locale),
        },
        {
          key: 'platformFeesPaidSyp',
          label: t.merchant.dashboard.platformFeesLabel,
          value: formatSyp(campaign.stats.platformFeesPaidSyp, locale),
        },
        {
          key: 'conversionRatePercent',
          label: t.merchant.dashboard.conversionRateLabel,
          value: formatPercent(campaign.stats.conversionRatePercent, locale),
        },
      ]
    : [];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.topBar}>
        <Pressable
          testID="merchant-campaign-back-button"
          disabled={isClosing}
          onPress={handleGoBack}
          accessibilityRole="button"
          accessibilityLabel={t.common.back}
          accessibilityState={{ disabled: isClosing }}
          style={[styles.backButton, isClosing ? styles.backButtonDisabled : null]}
        >
          <Text style={[styles.backChevron, getMirrorTransform(locale)]}>{'‹'}</Text>
          <Text style={[Typography.label, directionalText, styles.backLabel]}>
            {t.common.back}
          </Text>
        </Pressable>

        <Text
          style={[Typography.section, directionalText, styles.topBarTitle]}
          numberOfLines={1}
        >
          {t.merchant.campaigns.detailsTitle}
        </Text>

        <View style={styles.topBarSpacer} />
      </View>

      {isLoading && !campaign ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <SkeletonBlock height={200} borderRadius={Radii.panel} />
          <View style={styles.skeletonStack}>
            <SkeletonBlock width="78%" height={28} />
            <SkeletonBlock width="100%" height={68} />
          </View>
          <SkeletonBlock height={156} borderRadius={Radii.panel} />
          <SkeletonBlock height={156} borderRadius={Radii.panel} />
        </ScrollView>
      ) : errorMessage && !campaign ? (
        <ScrollView
          contentContainerStyle={styles.errorContainer}
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
            <Text style={[Typography.section, directionalText, styles.errorText]}>
              {t.merchant.campaigns.detailsLoadError}
            </Text>
            <Text style={[Typography.body, directionalText, styles.mutedText]}>
              {errorMessage}
            </Text>
            <AppButton
              testID="merchant-campaign-detail-retry-button"
              variant="primary"
              label={t.common.retry}
              loading={isRefreshing}
              onPress={handleRefresh}
            />
          </View>
        </ScrollView>
      ) : campaign ? (
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
          <View style={styles.mediaFrame}>
            {showImageFallback ? (
              <View style={styles.storeFallback} accessible={false}>
                <View style={styles.monogramBadge}>
                  <Text style={styles.monogramText}>
                    {getShopMonogram(campaign.shopName)}
                  </Text>
                </View>
                <Text style={[Typography.label, directionalText, styles.fallbackShopText]}>
                  {campaign.shopName}
                </Text>
              </View>
            ) : (
              <Image
                source={{ uri: safeImageUrl }}
                style={styles.image}
                contentFit="cover"
                transition={reducedMotion ? 0 : 180}
                onError={() => {
                  if (safeImageUrl) {
                    setFailedImageUrl(safeImageUrl);
                  }
                }}
                accessibilityIgnoresInvertColors
              />
            )}
          </View>

          <View style={styles.identityBlock}>
            <View style={styles.statusHeaderRow}>
              <Text style={[Typography.label, directionalText, styles.mutedText]}>
                {campaign.shopName}
              </Text>
              <StatusBadge
                label={
                  campaign.status === 'active'
                    ? t.campaigns.activeStatus
                    : t.campaigns.endedStatus
                }
                tone={campaign.status === 'active' ? 'success' : 'neutral'}
                showDot
              />
            </View>

            <Text style={[Typography.display, directionalText]}>
              {campaign.productName}
            </Text>

            {campaign.description.trim().length > 0 ? (
              <Text style={[Typography.body, directionalText, styles.mutedText]}>
                {campaign.description}
              </Text>
            ) : null}
          </View>

          {justClosed ? (
            <View style={styles.successBanner} accessibilityLiveRegion="polite">
              <Text style={[Typography.label, directionalText, styles.successText]}>
                {t.merchant.campaigns.closeSuccessBanner}
              </Text>
            </View>
          ) : null}

          <View style={styles.surfaceCard}>
            <Text style={[Typography.section, directionalText]}>
              {t.merchant.campaigns.pricingSectionTitle}
            </Text>

            {campaign.originalPriceSyp !== null ? (
              <>
                <View style={styles.summaryRow}>
                  <Text style={[Typography.label, directionalText, styles.mutedText]}>
                    {t.campaigns.originalPrice}
                  </Text>
                  <Text style={[Typography.label, directionalText]}>
                    {formatSyp(campaign.originalPriceSyp, locale)}
                  </Text>
                </View>
                <View style={styles.divider} />
              </>
            ) : null}

            <View style={styles.summaryRow}>
              <Text style={[Typography.label, directionalText, styles.mutedText]}>
                {t.campaigns.discountLabel}
              </Text>
              <Text style={[Typography.label, directionalText]}>
                {formatPercent(campaign.discountPercent, locale)}
              </Text>
            </View>

            {campaign.finalPriceSyp !== null ? (
              <>
                <View style={styles.divider} />
                <View style={styles.summaryRow}>
                  <Text style={[Typography.label, directionalText, styles.mutedText]}>
                    {t.campaigns.finalPrice}
                  </Text>
                  <Text style={[Typography.section, directionalText]}>
                    {formatSyp(campaign.finalPriceSyp, locale)}
                  </Text>
                </View>
              </>
            ) : null}

            <View style={styles.divider} />

            <View style={styles.summaryRow}>
              <Text style={[Typography.label, directionalText, styles.mutedText]}>
                {t.campaigns.commission}
              </Text>
              <Text style={[Typography.section, directionalText, styles.highlightValue]}>
                {commissionDisplay}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.summaryRow}>
              <Text style={[Typography.label, directionalText, styles.mutedText]}>
                {t.merchant.campaigns.endsAtLabel}
              </Text>
              <Text style={[Typography.label, directionalText]}>
                {formatCampaignDate(campaign.endsAt, locale)}
              </Text>
            </View>
          </View>

          <View style={styles.surfaceCard}>
            <Text style={[Typography.section, directionalText]}>
              {t.merchant.campaigns.reservesSectionTitle}
            </Text>

            <View style={styles.summaryRow}>
              <Text style={[Typography.label, directionalText, styles.mutedText]}>
                {t.merchant.campaigns.initialReserveLabel}
              </Text>
              <Text style={[Typography.label, directionalText]}>
                {formatSyp(campaign.usage.worstCaseReserveSyp, locale)}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.summaryRow}>
              <Text style={[Typography.label, directionalText, styles.mutedText]}>
                {t.merchant.campaigns.remainingReserveLabel}
              </Text>
              <Text style={[Typography.section, directionalText, styles.highlightValue]}>
                {formatSyp(campaign.usage.lockedBudgetSyp, locale)}
              </Text>
            </View>

            {campaign.usage.maxItems !== null ? (
              <>
                <View style={styles.divider} />
                <View style={styles.summaryRow}>
                  <Text style={[Typography.label, directionalText, styles.mutedText]}>
                    {t.merchant.campaigns.salesProgressLabel}
                  </Text>
                  <Text style={[Typography.label, directionalText]}>
                    {`${campaign.usage.itemsSold} / ${campaign.usage.maxItems}`}
                  </Text>
                </View>
              </>
            ) : null}
          </View>

          <View style={styles.surfaceCard}>
            <Text style={[Typography.section, directionalText]}>
              {t.merchant.campaigns.statsSectionTitle}
            </Text>
            <View style={styles.statsGrid}>
              {statsItems.map((item) => (
                <View key={item.key} style={styles.statTile}>
                  <Text style={[Typography.caption, directionalText]}>{item.label}</Text>
                  <Text style={[Typography.section, directionalText, styles.statValue]}>
                    {item.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {validatedDirectReferralUrl ? (
            <View testID="merchant-direct-referral-card" style={styles.mauvePanel}>
              <Text style={[Typography.section, directionalText]}>
                {t.merchant.campaigns.directReferralTitle}
              </Text>
              <Text style={[Typography.caption, directionalText]}>
                {t.merchant.campaigns.directReferralSubtitle}
              </Text>

              <View style={styles.urlBox}>
                <Text selectable style={[Typography.body, LtrTextStyle, styles.urlText]}>
                  {validatedDirectReferralUrl}
                </Text>
              </View>

              {shareError ? (
                <Text style={[Typography.caption, directionalText, styles.errorText]}>
                  {shareError}
                </Text>
              ) : null}

              <AppButton
                testID="merchant-direct-referral-share-button"
                variant="primary"
                label={t.merchant.campaigns.shareDirectLinkAction}
                haptic="medium"
                onPress={() => void handleShareDirectLink()}
              />

              <AppButton
                testID="merchant-direct-referral-copy-button"
                variant="secondary"
                label={
                  hasCopiedDirectLink
                    ? t.common.copied
                    : t.merchant.campaigns.copyDirectLinkAction
                }
                onPress={() => void handleCopyDirectLink()}
              />
            </View>
          ) : null}

          <View style={styles.actionSection}>
            {closeError ? (
              <View style={styles.errorBanner} accessibilityLiveRegion="polite">
                <Text style={[Typography.label, directionalText, styles.errorText]}>
                  {closeError}
                </Text>
              </View>
            ) : null}

            {campaign.status === 'active' ? (
              <AppButton
                testID="merchant-campaign-close-button"
                variant="danger"
                label={t.merchant.campaigns.closeCampaignAction}
                loadingLabel={t.merchant.campaigns.closingCampaign}
                loading={isClosing}
                disabled={isClosing}
                haptic="medium"
                onPress={() => setIsConfirmModalOpen(true)}
              />
            ) : !justClosed ? (
              <View style={styles.infoBanner}>
                <Text style={[Typography.body, directionalText, styles.infoText]}>
                  {t.merchant.campaigns.campaignEndedNotice}
                </Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
      ) : null}

      <Modal
        visible={isConfirmModalOpen}
        transparent
        animationType={reducedMotion ? 'none' : 'fade'}
        onRequestClose={handleDismissConfirm}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard} accessibilityViewIsModal>
            <Text style={[Typography.section, directionalText]}>
              {t.merchant.campaigns.closeConfirmTitle}
            </Text>
            <Text style={[Typography.body, directionalText, styles.mutedText]}>
              {t.merchant.campaigns.closeConfirmMessage}
            </Text>

            {closeError ? (
              <View style={styles.errorBanner}>
                <Text style={[Typography.label, directionalText, styles.errorText]}>
                  {closeError}
                </Text>
              </View>
            ) : null}

            <View style={styles.modalActions}>
              <AppButton
                testID="merchant-campaign-confirm-close-button"
                variant="danger"
                label={t.merchant.campaigns.closeConfirmAction}
                loadingLabel={t.merchant.campaigns.closingCampaign}
                loading={isClosing}
                disabled={isClosing}
                haptic="medium"
                onPress={() => void handleConfirmClose()}
              />
              <AppButton
                testID="merchant-campaign-cancel-close-button"
                variant="secondary"
                label={t.common.cancel}
                disabled={isClosing}
                onPress={handleDismissConfirm}
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.compact,
    paddingVertical: Spacing.xs,
    borderBottomWidth: BorderWidth.hairline,
    borderBottomColor: Colors.rule,
    backgroundColor: Colors.canvas,
    gap: Spacing.compact,
  },
  backButton: {
    minWidth: TouchTarget.minWidth,
    minHeight: TouchTarget.minHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.compact,
    borderRadius: Radii.control,
    gap: Spacing.xs,
  },
  backButtonDisabled: {
    opacity: 0.45,
  },
  backChevron: {
    fontFamily: FontFamily.bold,
    fontSize: 24,
    lineHeight: 28,
    color: Colors.ink,
  },
  backLabel: {
    color: Colors.ink,
  },
  topBarTitle: {
    flex: 1,
    textAlign: 'center',
    color: Colors.ink,
  },
  topBarSpacer: {
    minWidth: TouchTarget.minWidth,
  },
  scrollContent: {
    paddingHorizontal: Spacing.gutter,
    paddingTop: Spacing.gutter,
    paddingBottom: Spacing.section,
    gap: Spacing.section,
  },
  skeletonStack: {
    gap: Spacing.compact + 2,
  },
  errorContainer: {
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
  mediaFrame: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: Radii.panel,
    overflow: 'hidden',
    backgroundColor: Colors.mauveTint,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  storeFallback: {
    flex: 1,
    backgroundColor: Colors.mauveTint,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.gutter,
    gap: Spacing.compact,
  },
  monogramBadge: {
    width: 56,
    height: 56,
    borderRadius: Radii.panel,
    backgroundColor: Colors.surface,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramText: {
    fontFamily: FontFamily.bold,
    fontSize: 24,
    lineHeight: 32,
    color: Colors.dustyMauve,
  },
  fallbackShopText: {
    color: Colors.ink,
    textAlign: 'center',
  },
  identityBlock: {
    gap: Spacing.compact,
  },
  statusHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.compact,
  },
  surfaceCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.gutter,
    gap: Spacing.compact + 4,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.compact,
  },
  highlightValue: {
    color: Colors.action,
  },
  divider: {
    height: BorderWidth.hairline,
    backgroundColor: Colors.rule,
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
  mauvePanel: {
    backgroundColor: Colors.mauveTint,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.gutter,
    gap: Spacing.compact + 4,
  },
  urlBox: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.control,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.compact + 4,
  },
  urlText: {
    color: Colors.ink,
  },
  actionSection: {
    gap: Spacing.compact + 4,
  },
  successBanner: {
    backgroundColor: Colors.successBg,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: 'rgba(49, 93, 71, 0.25)',
    padding: Spacing.gutter,
  },
  successText: {
    color: Colors.success,
  },
  errorBanner: {
    backgroundColor: Colors.dangerBg,
    borderRadius: Radii.control,
    borderWidth: BorderWidth.hairline,
    borderColor: 'rgba(152, 45, 61, 0.25)',
    padding: Spacing.compact + 4,
  },
  errorText: {
    color: Colors.danger,
  },
  infoBanner: {
    backgroundColor: Colors.infoBg,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: 'rgba(83, 71, 103, 0.22)',
    padding: Spacing.gutter,
  },
  infoText: {
    color: Colors.info,
  },
  mutedText: {
    color: Colors.muted,
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
  modalActions: {
    gap: Spacing.compact + 4,
  },
});
