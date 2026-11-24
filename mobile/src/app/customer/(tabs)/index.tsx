import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
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

import {
  AppButton,
  AppInput,
  QrCodeBox,
  SkeletonBlock,
  StatusBadge,
} from '@/components/ui';
import type { StatusBadgeTone } from '@/components/ui';
import { sanitizeImageUrl } from '@/core/api';
import { useAuth } from '@/core/auth';
import { useLocale } from '@/core/i18n';
import type { TranslationDictionary } from '@/core/i18n';
import { useAndroidBack } from '@/core/navigation';
import {
  formatCampaignDate,
  formatPercent,
  formatSyp,
  getDirectionalTextStyle,
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
import {
  extractReferralCode,
  useCustomerOfferQr,
  useCustomerRecentOffers,
  usePublicOfferLookup,
} from '@/features/customer/offers';
import type { OfferPassStatus } from '@/features/customer/offers';

function getShopMonogram(shopName: string): string {
  const trimmed = shopName.trim();
  if (!trimmed) {
    return 'م';
  }
  return Array.from(trimmed)[0] ?? 'م';
}

function getPassStatusTone(status: OfferPassStatus): StatusBadgeTone {
  if (status === 'active') {
    return 'success';
  }
  if (status === 'redeemed') {
    return 'info';
  }
  return 'danger';
}

function localizeAttributionLabel(
  rawLabel: string,
  t: TranslationDictionary,
): string {
  const normalized = rawLabel.trim().toLowerCase();
  if (normalized === 'merchant direct' || normalized === 'merchant_direct') {
    return t.customer.offers.attributionMerchant;
  }
  if (normalized === 'marketer referral' || normalized === 'marketer') {
    return t.customer.offers.attributionMarketer;
  }
  return rawLabel;
}

export default function CustomerOffersScreen() {
  const { locale, t } = useLocale();
  const { user, activeRole, pendingReferralCode, clearPendingReferralCode } =
    useAuth();
  const router = useRouter();
  const isFocused = useIsFocused();
  const reducedMotion = Boolean(useReducedMotion());
  const incomingUrl = Linking.useURL();
  const { code: routeCodeParam } = useLocalSearchParams<{
    code?: string | string[];
  }>();

  const {
    rawInput,
    setRawInput,
    activeCode,
    offer,
    isLoading,
    isRefreshing,
    validationError,
    error: lookupError,
    errorCode: lookupErrorCode,
    lookupOffer,
    refreshOffer,
    clearOffer,
  } = usePublicOfferLookup();

  const {
    offerPass,
    isIssuing,
    error: issueError,
    isSelfPromotionForbidden,
    issueOfferQr,
    clearOfferPass,
  } = useCustomerOfferQr();

  const { recentOffers } = useCustomerRecentOffers();
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const lastHandledRouteCodeRef = useRef<string | null>(null);
  const lastHandledIncomingUrlRef = useRef<string | null>(null);
  const suppressedIncomingUrlRef = useRef<string | null>(null);

  const sessionScopeKey =
    user && activeRole === 'customer' ? `${user.id}:${activeRole}` : null;
  const lastSessionScopeRef = useRef<string | null>(sessionScopeKey);

  useAndroidBack({
    enabled: isFocused,
    isBusy: isLoading || isIssuing,
    isRootTab: true,
  });

  // Reset deep-link tracking and failed image state when switching accounts or roles.
  useEffect(() => {
    if (lastSessionScopeRef.current !== sessionScopeKey) {
      lastSessionScopeRef.current = sessionScopeKey;
      lastHandledRouteCodeRef.current = null;
      lastHandledIncomingUrlRef.current = null;
      suppressedIncomingUrlRef.current = null;
      setFailedImageUrl(null);
    }
  }, [sessionScopeKey]);

  // Reset failed image state whenever the loaded offer or its image URL changes.
  useEffect(() => {
    setFailedImageUrl(null);
  }, [activeCode, offer?.imageUrl]);

  // Drop stale OfferQrPass immediately if the offer vanishes, ends, or returns NOT_FOUND / CAMPAIGN_ENDED.
  useEffect(() => {
    if (
      offerPass &&
      (lookupErrorCode === 'NOT_FOUND' ||
        lookupErrorCode === 'CAMPAIGN_ENDED' ||
        offer?.status === 'ended' ||
        (!offer && !isLoading && !isRefreshing))
    ) {
      clearOfferPass();
    }
  }, [
    clearOfferPass,
    isLoading,
    isRefreshing,
    lookupErrorCode,
    offer,
    offerPass,
  ]);

  const extractCodeFromCandidate = useCallback((source: string): string | null => {
    const direct = extractReferralCode(source);
    if (direct) {
      return direct;
    }

    const parsed = Linking.parse(source);
    const queryCode = parsed.queryParams?.code;
    const queryCodeStr = Array.isArray(queryCode) ? queryCode[0] : queryCode;
    return typeof queryCodeStr === 'string'
      ? extractReferralCode(queryCodeStr)
      : null;
  }, []);

  // Capture referral code from pending context, ?code= route param, or incoming URL independently.
  useEffect(() => {
    const rawRouteCode =
      (Array.isArray(routeCodeParam) ? routeCodeParam[0] : routeCodeParam)?.trim() ||
      null;
    const normalizedIncomingUrl = incomingUrl?.trim() || null;
    const normalizedPendingCode = pendingReferralCode?.trim() || null;

    if (
      suppressedIncomingUrlRef.current !== null &&
      normalizedIncomingUrl !== suppressedIncomingUrlRef.current
    ) {
      suppressedIncomingUrlRef.current = null;
    }

    if (normalizedPendingCode) {
      clearPendingReferralCode();
      const extracted = extractCodeFromCandidate(normalizedPendingCode);
      if (extracted) {
        if (rawRouteCode && extractCodeFromCandidate(rawRouteCode) === extracted) {
          lastHandledRouteCodeRef.current = rawRouteCode;
        }
        if (
          normalizedIncomingUrl &&
          extractCodeFromCandidate(normalizedIncomingUrl) === extracted
        ) {
          lastHandledIncomingUrlRef.current = normalizedIncomingUrl;
          suppressedIncomingUrlRef.current = null;
        }
        clearOfferPass();
        void lookupOffer(extracted);
        return;
      }
    }

    if (
      normalizedIncomingUrl &&
      normalizedIncomingUrl !== lastHandledIncomingUrlRef.current &&
      normalizedIncomingUrl !== suppressedIncomingUrlRef.current
    ) {
      lastHandledIncomingUrlRef.current = normalizedIncomingUrl;
      const extracted = extractCodeFromCandidate(normalizedIncomingUrl);
      if (extracted) {
        if (rawRouteCode && extractCodeFromCandidate(rawRouteCode) === extracted) {
          lastHandledRouteCodeRef.current = rawRouteCode;
        }
        clearOfferPass();
        void lookupOffer(extracted);
        return;
      }
    }

    if (rawRouteCode && rawRouteCode !== lastHandledRouteCodeRef.current) {
      lastHandledRouteCodeRef.current = rawRouteCode;
      const extracted = extractCodeFromCandidate(rawRouteCode);
      if (extracted) {
        clearOfferPass();
        void lookupOffer(extracted);
      }
    }
  }, [
    clearOfferPass,
    clearPendingReferralCode,
    extractCodeFromCandidate,
    incomingUrl,
    lookupOffer,
    pendingReferralCode,
    routeCodeParam,
  ]);

  const handlePasteFromClipboard = useCallback(async () => {
    if (isLoading || isIssuing) {
      return;
    }

    try {
      const clipboardText = (await Clipboard.getStringAsync()).trim();
      if (!clipboardText) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
          () => undefined,
        );
        return;
      }

      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
        () => undefined,
      );
      setRawInput(clipboardText);
      setFailedImageUrl(null);

      const candidateCode = extractReferralCode(clipboardText);
      if (!candidateCode || candidateCode !== activeCode) {
        clearOfferPass();
      }
      void lookupOffer(clipboardText);
    } catch {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => undefined,
      );
    }
  }, [activeCode, clearOfferPass, isIssuing, isLoading, lookupOffer, setRawInput]);

  const handleLookupPress = useCallback(() => {
    if (isLoading || isIssuing) {
      return;
    }
    setFailedImageUrl(null);
    const candidateCode = extractReferralCode(rawInput);
    if (!candidateCode || candidateCode !== activeCode) {
      clearOfferPass();
    }
    void lookupOffer();
  }, [activeCode, clearOfferPass, isIssuing, isLoading, lookupOffer, rawInput]);

  const handleClearPress = useCallback(() => {
    if (isLoading || isIssuing) {
      return;
    }
    lastHandledRouteCodeRef.current = null;
    lastHandledIncomingUrlRef.current = null;
    suppressedIncomingUrlRef.current = incomingUrl?.trim() || null;
    setFailedImageUrl(null);
    if (routeCodeParam !== undefined) {
      router.setParams({ code: undefined });
    }
    clearOfferPass();
    clearOffer();
  }, [
    clearOffer,
    clearOfferPass,
    incomingUrl,
    isIssuing,
    isLoading,
    routeCodeParam,
    router,
  ]);

  const handleRefresh = useCallback(() => {
    setFailedImageUrl(null);
    void refreshOffer();
  }, [refreshOffer]);

  const handleRetryLookup = useCallback(() => {
    setFailedImageUrl(null);
    if (activeCode) {
      void refreshOffer();
    } else {
      void lookupOffer();
    }
  }, [activeCode, lookupOffer, refreshOffer]);

  const handleSelectRecentCode = useCallback(
    (code: string) => {
      if (isLoading || isIssuing) {
        return;
      }
      setFailedImageUrl(null);
      if (code !== activeCode) {
        clearOfferPass();
      }
      void lookupOffer(code);
    },
    [activeCode, clearOfferPass, isIssuing, isLoading, lookupOffer],
  );

  const handleIssueQrPress = useCallback(() => {
    const targetCode = activeCode ?? extractReferralCode(rawInput);
    if (!targetCode || isIssuing || isLoading) {
      return;
    }
    void issueOfferQr(targetCode);
  }, [activeCode, isIssuing, isLoading, issueOfferQr, rawInput]);

  const directionalText = getDirectionalTextStyle(locale);
  const layoutTransition = reducedMotion ? undefined : LinearTransition.duration(180);

  const safeImageUrl = sanitizeImageUrl(offer?.imageUrl);
  const showImageFallback = !safeImageUrl || failedImageUrl === safeImageUrl;
  const isOfferActive = offer?.status === 'active';
  const showClearAction = Boolean(offer || lookupError || rawInput.trim().length > 0);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            activeCode ? (
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={Colors.action}
                colors={[Colors.action]}
              />
            ) : undefined
          }
        >
          <View style={styles.header}>
            <Text style={[Typography.display, directionalText]}>
              {t.customer.offers.screenTitle}
            </Text>
            <Text style={[Typography.body, directionalText, styles.subtitle]}>
              {t.customer.offers.subtitle}
            </Text>
          </View>

          <Animated.View layout={layoutTransition} style={styles.lookupCard}>
            <AppInput
              testID="customer-offer-code-input"
              label={t.customer.offers.codeInputLabel}
              placeholder={t.customer.offers.codeInputPlaceholder}
              hint={t.customer.offers.codeInputHint}
              value={rawInput}
              onChangeText={setRawInput}
              forceLtr
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              editable={!isLoading && !isIssuing}
              onSubmitEditing={handleLookupPress}
              error={validationError}
              endAccessory={
                <Pressable
                  testID="customer-offer-paste-button"
                  disabled={isLoading || isIssuing}
                  onPress={() => {
                    void handlePasteFromClipboard();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t.customer.offers.pasteAction}
                  accessibilityState={{ disabled: isLoading || isIssuing }}
                  style={styles.pasteButton}
                >
                  <Text style={[Typography.label, styles.pasteButtonText]}>
                    {t.customer.offers.pasteAction}
                  </Text>
                </Pressable>
              }
            />

            <View style={styles.lookupActions}>
              <AppButton
                testID="customer-offer-lookup-button"
                variant="primary"
                label={t.customer.offers.lookupAction}
                loadingLabel={t.customer.offers.lookingUpAction}
                loading={isLoading}
                disabled={isLoading || isIssuing}
                haptic="light"
                onPress={handleLookupPress}
              />

              {showClearAction ? (
                <AppButton
                  testID="customer-offer-clear-button"
                  variant="secondary"
                  label={t.customer.offers.clearAction}
                  disabled={isLoading || isIssuing}
                  onPress={handleClearPress}
                />
              ) : null}
            </View>
          </Animated.View>

          {isLoading && !offer ? (
            <View style={styles.offerCard}>
              <SkeletonBlock width="100%" height={180} borderRadius={Radii.panel} />
              <SkeletonBlock width="48%" height={24} />
              <SkeletonBlock width="78%" height={22} />
              <SkeletonBlock width="100%" height={56} />
              <SkeletonBlock width="100%" height={48} borderRadius={Radii.control} />
            </View>
          ) : null}

          {lookupError && !isLoading ? (
            <View
              accessibilityLiveRegion="polite"
              style={[
                styles.feedbackCard,
                lookupErrorCode === 'CAMPAIGN_ENDED'
                  ? styles.infoFeedbackCard
                  : styles.errorFeedbackCard,
              ]}
            >
              <Text
                style={[
                  Typography.body,
                  directionalText,
                  lookupErrorCode === 'CAMPAIGN_ENDED'
                    ? styles.infoFeedbackText
                    : styles.errorFeedbackText,
                ]}
              >
                {lookupError}
              </Text>
              <AppButton
                testID="customer-offer-retry-button"
                variant="secondary"
                label={t.common.retry}
                loading={isRefreshing}
                disabled={isRefreshing}
                onPress={handleRetryLookup}
              />
            </View>
          ) : null}

          {offer ? (
            <Animated.View
              entering={reducedMotion ? undefined : FadeInDown.duration(220)}
              layout={layoutTransition}
              style={styles.offerCard}
            >
              <View style={styles.mediaFrame}>
                {!showImageFallback && safeImageUrl ? (
                  <Image
                    source={{ uri: safeImageUrl }}
                    style={styles.heroImage}
                    contentFit="cover"
                    transition={reducedMotion ? 0 : 180}
                    onError={() => setFailedImageUrl(safeImageUrl)}
                  />
                ) : (
                  <View style={styles.fallbackHero}>
                    <View style={styles.monogramCircle}>
                      <Text style={styles.monogramText}>
                        {getShopMonogram(offer.shopName)}
                      </Text>
                    </View>
                    <Text
                      style={[Typography.label, directionalText, styles.fallbackShopName]}
                      numberOfLines={1}
                    >
                      {offer.shopName}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.badgesRow}>
                <StatusBadge
                  label={
                    isOfferActive
                      ? t.customer.offers.offerStatusActive
                      : t.customer.offers.offerStatusEnded
                  }
                  tone={isOfferActive ? 'success' : 'info'}
                  showDot
                />
                {offer.attributionLabel ? (
                  <StatusBadge
                    label={localizeAttributionLabel(offer.attributionLabel, t)}
                    tone="mauve"
                  />
                ) : null}
                <StatusBadge
                  label={`-${formatPercent(offer.discountPercent, locale)}`}
                  tone="info"
                />
              </View>

              <View style={styles.offerHeadingBlock}>
                <Text
                  testID="customer-offer-product-name"
                  style={[Typography.section, directionalText]}
                >
                  {offer.productName}
                </Text>
                <Text
                  testID="customer-offer-shop-name"
                  style={[Typography.label, directionalText, styles.shopNameText]}
                >
                  {offer.shopName}
                </Text>
                {offer.shopDetails ? (
                  <Text style={[Typography.caption, directionalText, styles.mutedText]}>
                    {offer.shopDetails}
                  </Text>
                ) : null}
                {offer.description ? (
                  <Text style={[Typography.body, directionalText, styles.descriptionText]}>
                    {offer.description}
                  </Text>
                ) : null}
              </View>

              <View style={styles.pricingPanel}>
                {offer.originalPriceSyp !== null ? (
                  <View style={styles.detailRow}>
                    <Text style={[Typography.caption, directionalText, styles.detailText]}>
                      {t.customer.offers.originalPriceLabel}
                    </Text>
                    <Text
                      style={[
                        Typography.caption,
                        styles.tabularNum,
                        styles.detailText,
                        styles.originalPriceText,
                      ]}
                    >
                      {formatSyp(offer.originalPriceSyp, locale)}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.detailRow}>
                  <Text style={[Typography.caption, directionalText, styles.detailText]}>
                    {t.customer.offers.discountLabel}
                  </Text>
                  <Text style={[Typography.label, styles.tabularNum, styles.detailText]}>
                    {formatPercent(offer.discountPercent, locale)}
                  </Text>
                </View>

                {offer.finalPriceSyp !== null ? (
                  <View style={styles.detailRow}>
                    <Text style={[Typography.label, directionalText, styles.detailText]}>
                      {t.customer.offers.finalPriceLabel}
                    </Text>
                    <Text
                      testID="customer-offer-final-price"
                      style={[
                        Typography.section,
                        styles.tabularNum,
                        styles.detailText,
                        styles.finalPriceText,
                      ]}
                    >
                      {formatSyp(offer.finalPriceSyp, locale)}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.detailRow}>
                  <Text style={[Typography.caption, directionalText, styles.detailText]}>
                    {t.customer.offers.endsAtLabel}
                  </Text>
                  <Text style={[Typography.caption, styles.tabularNum, styles.detailText]}>
                    {formatCampaignDate(offer.endsAt, locale)}
                  </Text>
                </View>
              </View>

              {!isOfferActive ? (
                <View style={[styles.feedbackCard, styles.infoFeedbackCard]}>
                  <Text
                    style={[Typography.label, directionalText, styles.infoFeedbackText]}
                  >
                    {t.customer.offers.offerEndedError}
                  </Text>
                </View>
              ) : (
                <AppButton
                  testID="customer-issue-qr-button"
                  variant="primary"
                  label={
                    offerPass
                      ? t.customer.offers.reissueQrAction
                      : t.customer.offers.issueQrAction
                  }
                  loadingLabel={t.customer.offers.issuingQrAction}
                  loading={isIssuing}
                  disabled={isIssuing || isLoading}
                  haptic="medium"
                  onPress={handleIssueQrPress}
                />
              )}

              {issueError ? (
                <View
                  accessibilityLiveRegion="polite"
                  style={[
                    styles.feedbackCard,
                    isSelfPromotionForbidden
                      ? styles.infoFeedbackCard
                      : styles.errorFeedbackCard,
                  ]}
                >
                  <Text
                    style={[
                      Typography.label,
                      directionalText,
                      isSelfPromotionForbidden
                        ? styles.infoFeedbackText
                        : styles.errorFeedbackText,
                    ]}
                  >
                    {issueError}
                  </Text>
                </View>
              ) : null}
            </Animated.View>
          ) : null}

          {offerPass ? (
            <Animated.View
              entering={reducedMotion ? undefined : FadeInDown.duration(220)}
              layout={layoutTransition}
              style={styles.passSection}
            >
              <View style={styles.passHeader}>
                <Text style={[Typography.section, directionalText, styles.passTitle]}>
                  {t.customer.offers.qrSectionTitle}
                </Text>
                <StatusBadge
                  label={t.customer.offers.qrStatuses[offerPass.status]}
                  tone={getPassStatusTone(offerPass.status)}
                  showDot
                />
              </View>

              <QrCodeBox
                testID="customer-offer-qr-box"
                qrToken={offerPass.qrToken}
                passCode={offerPass.passCode}
                passCodeLabel={t.customer.offers.qrPassCodeLabel}
                showCopyButton
                copyLabel={t.customer.offers.qrCopyCodeAction}
                copiedLabel={t.customer.offers.qrCopiedCodeAction}
                unavailableMessage={t.customer.offers.qrUnavailableFallback}
              />

              <View style={styles.cashReminderBox}>
                <Text
                  testID="customer-offer-cash-reminder"
                  style={[Typography.label, directionalText, styles.cashReminderText]}
                >
                  {t.customer.offers.qrCashReminder}
                </Text>
              </View>

              <View style={styles.passMetaRow}>
                <Text style={[Typography.caption, directionalText, styles.detailText]}>
                  {t.customer.offers.qrIssuedAtLabel}
                </Text>
                <Text style={[Typography.caption, styles.tabularNum, styles.detailText]}>
                  {formatCampaignDate(offerPass.createdAt, locale)}
                </Text>
              </View>
            </Animated.View>
          ) : null}

          {!offer && !isLoading ? (
            <View style={styles.emptySection}>
              <View style={styles.emptyCard}>
                <Text style={[Typography.section, directionalText]}>
                  {t.customer.offers.emptyTitle}
                </Text>
                <Text style={[Typography.body, directionalText, styles.mutedText]}>
                  {t.customer.offers.emptySubtitle}
                </Text>
              </View>

              {recentOffers.length > 0 ? (
                <View style={styles.recentCard}>
                  <View style={styles.recentHeader}>
                    <Text style={[Typography.section, directionalText]}>
                      {t.customer.offers.recentTitle}
                    </Text>
                    <Text style={[Typography.caption, directionalText]}>
                      {t.customer.offers.recentSubtitle}
                    </Text>
                  </View>

                  <View style={styles.recentList}>
                    {recentOffers.map((item) => (
                      <Pressable
                        key={item.code}
                        testID={`customer-recent-offer-${item.code}`}
                        onPress={() => handleSelectRecentCode(item.code)}
                        accessibilityRole="button"
                        accessibilityLabel={`${item.productName} - ${item.code}`}
                        style={({ pressed }) => [
                          styles.recentItem,
                          pressed ? styles.recentItemPressed : null,
                        ]}
                      >
                        <View style={styles.recentItemCopy}>
                          <Text
                            style={[Typography.label, directionalText]}
                            numberOfLines={1}
                          >
                            {item.productName}
                          </Text>
                          <Text
                            style={[Typography.caption, directionalText]}
                            numberOfLines={1}
                          >
                            {item.shopName}
                          </Text>
                        </View>
                        <Text style={[Typography.label, LtrTextStyle, styles.recentCode]}>
                          {item.code}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.gutter,
    paddingTop: Spacing.gutter,
    paddingBottom: Spacing.section * 2,
    gap: Spacing.gutter,
  },
  header: {
    gap: Spacing.xs,
  },
  subtitle: {
    color: Colors.muted,
  },
  lookupCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.gutter,
    gap: Spacing.gutter,
  },
  pasteButton: {
    minWidth: TouchTarget.minWidth,
    minHeight: TouchTarget.minHeight,
    paddingHorizontal: Spacing.compact,
    borderRadius: Radii.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pasteButtonText: {
    color: Colors.action,
  },
  lookupActions: {
    gap: Spacing.compact,
  },
  offerCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.gutter,
    gap: Spacing.gutter,
  },
  mediaFrame: {
    width: '100%',
    height: 180,
    borderRadius: Radii.panel,
    overflow: 'hidden',
    backgroundColor: Colors.mauveTint,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  fallbackHero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.compact,
    paddingHorizontal: Spacing.gutter,
  },
  monogramCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.surface,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramText: {
    fontFamily: FontFamily.bold,
    fontSize: 26,
    lineHeight: 32,
    color: Colors.ink,
  },
  fallbackShopName: {
    color: Colors.ink,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.compact,
  },
  offerHeadingBlock: {
    gap: Spacing.xs,
  },
  shopNameText: {
    color: Colors.action,
  },
  mutedText: {
    color: Colors.muted,
  },
  descriptionText: {
    color: Colors.ink,
    marginTop: Spacing.xs,
  },
  pricingPanel: {
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
  originalPriceText: {
    color: Colors.muted,
    textDecorationLine: 'line-through',
  },
  finalPriceText: {
    color: Colors.action,
  },
  feedbackCard: {
    borderRadius: Radii.control,
    borderWidth: BorderWidth.hairline,
    padding: Spacing.gutter,
    gap: Spacing.compact,
  },
  errorFeedbackCard: {
    backgroundColor: Colors.dangerBg,
    borderColor: 'rgba(152, 45, 61, 0.25)',
  },
  errorFeedbackText: {
    color: Colors.danger,
  },
  infoFeedbackCard: {
    backgroundColor: Colors.infoBg,
    borderColor: 'rgba(83, 71, 103, 0.25)',
  },
  infoFeedbackText: {
    color: Colors.info,
  },
  passSection: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.gutter,
    gap: Spacing.gutter,
  },
  passHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.compact,
  },
  passTitle: {
    flexGrow: 1,
    flexShrink: 1,
  },
  cashReminderBox: {
    backgroundColor: Colors.infoBg,
    borderRadius: Radii.control,
    borderWidth: BorderWidth.hairline,
    borderColor: 'rgba(83, 71, 103, 0.22)',
    padding: Spacing.compact + 4,
  },
  cashReminderText: {
    color: Colors.info,
  },
  passMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.compact,
  },
  emptySection: {
    gap: Spacing.gutter,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.section,
    gap: Spacing.compact,
  },
  recentCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.gutter,
    gap: Spacing.compact + 4,
  },
  recentHeader: {
    gap: Spacing.xs,
  },
  recentList: {
    gap: Spacing.compact,
  },
  recentItem: {
    minHeight: TouchTarget.minHeight,
    backgroundColor: Colors.canvas,
    borderRadius: Radii.control,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    paddingHorizontal: Spacing.compact + 4,
    paddingVertical: Spacing.compact,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.compact,
  },
  recentItemPressed: {
    backgroundColor: Colors.mauveTint,
  },
  recentItemCopy: {
    flexGrow: 1,
    flexShrink: 1,
    gap: 2,
  },
  recentCode: {
    color: Colors.action,
    flexShrink: 1,
  },
  tabularNum: {
    fontVariant: ['tabular-nums'],
  },
});
