import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  LinearTransition,
  useReducedMotion,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, SkeletonBlock, StatusBadge } from '@/components/ui';
import type { StatusBadgeTone } from '@/components/ui';
import { isSafeHttpUrl, sanitizeImageUrl } from '@/core/api';
import { useLocale } from '@/core/i18n';
import { useAndroidBack } from '@/core/navigation';
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
import { useCampaignDetails } from '@/features/campaigns';

function getShopMonogram(shopName: string): string {
  const trimmed = shopName.trim();
  if (!trimmed) {
    return 'م';
  }
  return Array.from(trimmed)[0] ?? 'م';
}

export default function CampaignDetailsScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const campaignId = Array.isArray(id) ? (id[0] ?? '') : (id ?? '');

  const router = useRouter();
  const { locale, t } = useLocale();
  const reducedMotion = useReducedMotion();

  const {
    viewModel,
    isLoading,
    isRefreshing,
    isJoining,
    errorMessage,
    joinError,
    refresh,
    joinCampaign,
  } = useCampaignDetails(campaignId);

  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const [hasCopiedLink, setHasCopiedLink] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useAndroidBack({
    isBusy: isJoining,
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
    if (isJoining) {
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }, [isJoining, router]);

  const handleRefresh = useCallback(() => {
    void refresh(true);
  }, [refresh]);

  const handleJoinPress = useCallback(() => {
    setShareError(null);
    void joinCampaign();
  }, [joinCampaign]);

  const campaign = viewModel?.campaign ?? null;
  const membership = viewModel?.membership ?? null;

  const safeImageUrl = sanitizeImageUrl(campaign?.imageUrl);
  const showImageFallback = !safeImageUrl || failedImageUrl === safeImageUrl;

  const validatedReferralUrl =
    membership?.status === 'approved' && isSafeHttpUrl(membership.referralUrl)
      ? membership.referralUrl.trim()
      : null;

  const handleShareOffer = useCallback(async () => {
    if (!campaign || !validatedReferralUrl) {
      setShareError(t.campaigns.invalidReferralUrl);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => undefined,
      );
      return;
    }

    setShareError(null);
    const shareMessage = `${t.campaigns.shareMessagePrefix} ${campaign.productName} - ${campaign.shopName}\n${validatedReferralUrl}`;

    try {
      const result = await Share.share({
        title: campaign.productName,
        message: shareMessage,
        url: validatedReferralUrl,
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
  }, [campaign, t.campaigns.invalidReferralUrl, t.campaigns.shareMessagePrefix, validatedReferralUrl]);

  const handleCopyReferralUrl = useCallback(async () => {
    if (!validatedReferralUrl) {
      return;
    }

    await Clipboard.setStringAsync(validatedReferralUrl);
    setHasCopiedLink(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => undefined,
    );

    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = setTimeout(() => {
      setHasCopiedLink(false);
    }, 2200);
  }, [validatedReferralUrl]);

  const directionalText = getDirectionalTextStyle(locale);

  const badgeInfo: { label: string; tone: StatusBadgeTone } | null = campaign
    ? membership?.status === 'approved'
      ? { label: t.campaigns.joinedStatus, tone: 'success' }
      : campaign.status === 'ended'
        ? { label: t.campaigns.endedStatus, tone: 'info' }
        : { label: t.campaigns.activeStatus, tone: 'mauve' }
    : null;

  const commissionDisplay = campaign
    ? campaign.commission.type === 'fixed'
      ? formatSyp(campaign.commission.amountSyp, locale)
      : campaign.commissionPerItemSyp !== null
        ? formatSyp(campaign.commissionPerItemSyp, locale)
        : formatPercent(campaign.commission.percent, locale)
    : '';

  const commissionTag =
    campaign?.commission.type === 'fixed'
      ? t.campaigns.fixedCommissionTag
      : t.campaigns.percentageCommissionTag;

  const layoutAnimation = reducedMotion ? undefined : LinearTransition.duration(200);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.topBar}>
        <Pressable
          testID="campaign-back-button"
          disabled={isJoining}
          onPress={handleGoBack}
          accessibilityRole="button"
          accessibilityLabel={t.common.back}
          accessibilityState={{ disabled: isJoining }}
          style={[styles.backButton, isJoining ? styles.backButtonDisabled : null]}
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
          {t.campaigns.detailsTitle}
        </Text>

        <View style={styles.topBarSpacer} />
      </View>

      {isLoading && !campaign ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <SkeletonBlock height={208} borderRadius={Radii.panel} />
          <View style={styles.skeletonGroup}>
            <SkeletonBlock width="45%" height={18} />
            <SkeletonBlock width="86%" height={28} />
            <SkeletonBlock width="100%" height={72} />
          </View>
          <SkeletonBlock height={148} borderRadius={Radii.panel} />
          <SkeletonBlock height={52} borderRadius={Radii.control} />
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
              {t.campaigns.detailsLoadError}
            </Text>
            <Text style={[Typography.body, directionalText, styles.mutedText]}>
              {errorMessage}
            </Text>
            <AppButton
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
            <View style={styles.shopStatusRow}>
              <Text style={[Typography.label, directionalText, styles.shopText]}>
                {`${t.campaigns.shopLabel}: ${campaign.shopName}`}
              </Text>
              {badgeInfo ? (
                <StatusBadge label={badgeInfo.label} tone={badgeInfo.tone} showDot />
              ) : null}
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

          <View style={styles.summaryCard}>
            {campaign.finalPriceSyp !== null ? (
              <View style={styles.summaryRow}>
                <Text style={[Typography.label, directionalText, styles.mutedText]}>
                  {t.campaigns.finalPrice}
                </Text>
                <View style={styles.pricePair}>
                  {campaign.originalPriceSyp !== null ? (
                    <Text style={[Typography.body, directionalText, styles.originalPrice]}>
                      {formatSyp(campaign.originalPriceSyp, locale)}
                    </Text>
                  ) : null}
                  <Text style={[Typography.section, directionalText]}>
                    {formatSyp(campaign.finalPriceSyp, locale)}
                  </Text>
                </View>
              </View>
            ) : null}

            <View style={styles.divider} />

            <View style={styles.summaryRow}>
              <Text style={[Typography.label, directionalText, styles.mutedText]}>
                {t.campaigns.discountLabel}
              </Text>
              <Text style={[Typography.label, directionalText]}>
                {formatPercent(campaign.discountPercent, locale)}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.commissionHighlightRow}>
              <View style={styles.commissionTitleCol}>
                <Text style={[Typography.label, directionalText]}>
                  {t.campaigns.commission}
                </Text>
                <Text style={[Typography.caption, directionalText]}>
                  {commissionTag}
                </Text>
              </View>
              <Text style={[Typography.section, directionalText, styles.commissionAmount]}>
                {commissionDisplay}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.summaryRow}>
              <Text style={[Typography.label, directionalText, styles.mutedText]}>
                {t.campaigns.endsAt}
              </Text>
              <Text style={[Typography.label, directionalText]}>
                {formatCampaignDate(campaign.endsAt, locale)}
              </Text>
            </View>
          </View>

          <Animated.View layout={layoutAnimation} style={styles.actionSection}>
            {joinError ? (
              <View accessibilityLiveRegion="polite" style={styles.errorBanner}>
                <Text style={[Typography.label, directionalText, styles.errorText]}>
                  {joinError}
                </Text>
              </View>
            ) : null}

            {validatedReferralUrl ? (
              <Animated.View
                entering={reducedMotion ? undefined : FadeInDown.duration(220)}
                style={styles.sharePanel}
              >
                <View style={styles.shareHeader}>
                  <StatusBadge label={t.campaigns.joinedStatus} tone="success" showDot />
                  <Text style={[Typography.section, directionalText, styles.shareTitle]}>
                    {t.campaigns.shareReadyTitle}
                  </Text>
                </View>

                <View style={styles.urlBox}>
                  <Text style={[Typography.caption, directionalText]}>
                    {t.campaigns.referralLinkLabel}
                  </Text>
                  <Text selectable style={[Typography.body, LtrTextStyle, styles.urlText]}>
                    {validatedReferralUrl}
                  </Text>
                </View>

                {shareError ? (
                  <Text style={[Typography.caption, directionalText, styles.errorText]}>
                    {shareError}
                  </Text>
                ) : null}

                <AppButton
                  testID="campaign-share-button"
                  variant="primary"
                  label={t.campaigns.shareAction}
                  haptic="medium"
                  onPress={() => void handleShareOffer()}
                />

                <AppButton
                  testID="campaign-copy-button"
                  variant="secondary"
                  label={hasCopiedLink ? t.common.copied : t.campaigns.copyLinkAction}
                  onPress={() => void handleCopyReferralUrl()}
                />
              </Animated.View>
            ) : campaign.status === 'ended' ? (
              <View style={styles.infoBanner}>
                <Text style={[Typography.body, directionalText, styles.infoText]}>
                  {t.campaigns.campaignEndedNotice}
                </Text>
              </View>
            ) : campaign.joinMode === 'approval_required' ? (
              <View style={styles.infoBanner}>
                <Text style={[Typography.body, directionalText, styles.infoText]}>
                  {t.campaigns.approvalRequiredNotice}
                </Text>
              </View>
            ) : (
              <AppButton
                testID="campaign-join-button"
                variant="primary"
                label={t.campaigns.joinAction}
                loadingLabel={t.campaigns.joining}
                loading={isJoining}
                disabled={isJoining}
                haptic="medium"
                onPress={handleJoinPress}
              />
            )}
          </Animated.View>
        </ScrollView>
      ) : null}
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
  skeletonGroup: {
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
  shopStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.compact,
  },
  shopText: {
    color: Colors.muted,
    flex: 1,
    flexShrink: 1,
  },
  mutedText: {
    color: Colors.muted,
  },
  summaryCard: {
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
  pricePair: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: Spacing.compact,
  },
  originalPrice: {
    textDecorationLine: 'line-through',
    color: Colors.muted,
  },
  commissionHighlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.compact,
    backgroundColor: Colors.mauveTint,
    borderRadius: Radii.control,
    padding: Spacing.compact + 4,
  },
  commissionTitleCol: {
    flex: 1,
    minWidth: 150,
    gap: 2,
  },
  commissionAmount: {
    color: Colors.action,
  },
  divider: {
    height: BorderWidth.hairline,
    backgroundColor: Colors.rule,
  },
  actionSection: {
    gap: Spacing.compact + 4,
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
  sharePanel: {
    backgroundColor: Colors.mauveTint,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.gutter,
    gap: Spacing.compact + 4,
  },
  shareHeader: {
    gap: Spacing.compact,
  },
  shareTitle: {
    color: Colors.ink,
  },
  urlBox: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.control,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.compact + 4,
    gap: Spacing.xs,
  },
  urlText: {
    color: Colors.ink,
  },
});
