import DateTimePicker from '@react-native-community/datetimepicker';
import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { useIsFocused, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, AppInput, SkeletonBlock } from '@/components/ui';
import { useAuth } from '@/core/auth';
import { useLocale } from '@/core/i18n';
import { useAndroidBack } from '@/core/navigation';
import {
  formatCampaignDate,
  formatSyp,
  getDirectionalTextStyle,
  getMirrorTransform,
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
import { useAccountRefresh } from '@/features/auth';
import {
  getMinimumCampaignEndDate,
  parseCampaignEndsAtToDate,
  useCreateMerchantCampaign,
} from '@/features/merchant/campaigns';

function CalendarGlyph({ disabled }: { disabled: boolean }) {
  const strokeColor = disabled ? Colors.muted : Colors.action;

  return (
    <View style={styles.calendarIconFrame} accessible={false}>
      <View style={styles.calendarTabsRow}>
        <View style={[styles.calendarTabPin, { backgroundColor: strokeColor }]} />
        <View style={[styles.calendarTabPin, { backgroundColor: strokeColor }]} />
      </View>
      <View style={[styles.calendarBody, { borderColor: strokeColor }]}>
        <View style={[styles.calendarHeaderBar, { backgroundColor: strokeColor }]} />
        <View style={[styles.calendarDayDot, { backgroundColor: strokeColor }]} />
      </View>
    </View>
  );
}

export default function CreateMerchantCampaignScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { user } = useAuth();
  const { locale, t } = useLocale();

  const {
    draft,
    fieldErrors,
    submitError,
    preview,
    previewError,
    isPreviewLoading,
    hasCompletePreviewInputs,
    isLaunching,
    updateField,
    selectEndsAtDate,
    retryPreview,
    submit,
  } = useCreateMerchantCampaign();

  useAndroidBack({
    enabled: isFocused,
    isBusy: isLaunching,
    isRootTab: false,
  });

  const descriptionRef = useRef<ComponentRef<typeof TextInput>>(null);
  const imageUrlRef = useRef<ComponentRef<typeof TextInput>>(null);
  const originalPriceRef = useRef<ComponentRef<typeof TextInput>>(null);
  const discountPercentRef = useRef<ComponentRef<typeof TextInput>>(null);
  const commissionAmountRef = useRef<ComponentRef<typeof TextInput>>(null);
  const maxItemsRef = useRef<ComponentRef<typeof TextInput>>(null);

  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [iosDraftDate, setIosDraftDate] = useState<Date>(() =>
    parseCampaignEndsAtToDate(draft.endsAt),
  );

  const { refreshAccount } = useAccountRefresh();
  const isVerified = user?.merchant?.verificationStatus === 'verified';

  useEffect(() => {
    if (isFocused && !isVerified) {
      void refreshAccount();
    }
  }, [isFocused, isVerified, refreshAccount]);
  const directionalText = getDirectionalTextStyle(locale);
  const [minimumEndDate, setMinimumEndDate] = useState<Date>(() =>
    getMinimumCampaignEndDate(),
  );
  const selectedEndDate = useMemo(
    () => parseCampaignEndsAtToDate(draft.endsAt),
    [draft.endsAt],
  );
  const pickerEndDate = useMemo(
    () =>
      selectedEndDate.getTime() < minimumEndDate.getTime()
        ? minimumEndDate
        : selectedEndDate,
    [minimumEndDate, selectedEndDate],
  );
  const formattedEndsAt = useMemo(
    () => (draft.endsAt.trim() ? formatCampaignDate(draft.endsAt, locale) : ''),
    [draft.endsAt, locale],
  );

  useEffect(() => {
    if (isFocused) {
      setMinimumEndDate(getMinimumCampaignEndDate());
    }
  }, [isFocused]);

  const handleCloseIosPicker = useCallback(() => {
    setIsDatePickerOpen(false);
  }, []);

  const handleOpenDatePicker = useCallback(() => {
    if (isLaunching) {
      return;
    }
    Keyboard.dismiss();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
      () => undefined,
    );
    const freshMinDate = getMinimumCampaignEndDate();
    setMinimumEndDate(freshMinDate);
    setIosDraftDate(
      selectedEndDate.getTime() < freshMinDate.getTime()
        ? freshMinDate
        : selectedEndDate,
    );
    setIsDatePickerOpen(true);
  }, [isLaunching, selectedEndDate]);

  const handleAndroidDateChange = useCallback(
    (event: DateTimePickerEvent, chosenDate?: Date) => {
      setIsDatePickerOpen(false);
      if (event.type === 'set' && chosenDate) {
        selectEndsAtDate(chosenDate);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => undefined,
        );
      }
    },
    [selectEndsAtDate],
  );

  const handleIosDateChange = useCallback(
    (_event: DateTimePickerEvent, chosenDate?: Date) => {
      if (chosenDate) {
        setIosDraftDate(chosenDate);
      }
    },
    [],
  );

  const handleConfirmIosDate = useCallback(() => {
    selectEndsAtDate(iosDraftDate);
    setIsDatePickerOpen(false);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => undefined,
    );
  }, [iosDraftDate, selectEndsAtDate]);

  const handleGoBack = useCallback(() => {
    if (isLaunching) {
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/merchant/campaigns' as Href);
    }
  }, [isLaunching, router]);

  const isInsufficientBalance = preview?.isAffordableByMerchant === false;
  const isSubmitDisabled =
    isLaunching ||
    !isVerified ||
    isPreviewLoading ||
    isInsufficientBalance ||
    !preview ||
    Boolean(previewError);
  const hasEndsAtError = Boolean(
    fieldErrors.endsAt && fieldErrors.endsAt.trim().length > 0,
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.topBar}>
        <Pressable
          testID="merchant-create-campaign-back-button"
          disabled={isLaunching}
          onPress={handleGoBack}
          accessibilityRole="button"
          accessibilityLabel={t.common.back}
          accessibilityState={{ disabled: isLaunching }}
          style={[styles.backButton, isLaunching ? styles.backButtonDisabled : null]}
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
          {t.merchant.createCampaign.screenTitle}
        </Text>

        <View style={styles.topBarSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {!isVerified ? (
            <View
              testID="merchant-create-campaign-unverified-banner"
              style={styles.dangerBanner}
              accessibilityLiveRegion="polite"
            >
              <Text style={[Typography.label, directionalText, styles.dangerText]}>
                {t.merchant.createCampaign.unverifiedNotice}
              </Text>
            </View>
          ) : null}

          <View style={styles.formCard}>
            <AppInput
              testID="campaign-product-name-input"
              label={t.merchant.createCampaign.productNameLabel}
              placeholder={t.merchant.createCampaign.productNamePlaceholder}
              value={draft.productName}
              onChangeText={(value) => updateField('productName', value)}
              error={fieldErrors.productName}
              editable={!isLaunching}
              maxLength={120}
              returnKeyType="next"
              onSubmitEditing={() => descriptionRef.current?.focus()}
            />

            <AppInput
              ref={descriptionRef}
              testID="campaign-description-input"
              label={t.merchant.createCampaign.descriptionLabel}
              placeholder={t.merchant.createCampaign.descriptionPlaceholder}
              value={draft.description}
              onChangeText={(value) => updateField('description', value)}
              error={fieldErrors.description}
              editable={!isLaunching}
              maxLength={2000}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              inputStyle={styles.multilineInput}
            />

            <AppInput
              ref={imageUrlRef}
              testID="campaign-image-url-input"
              label={t.merchant.createCampaign.imageUrlLabel}
              placeholder={t.merchant.createCampaign.imageUrlPlaceholder}
              value={draft.imageUrl}
              onChangeText={(value) => updateField('imageUrl', value)}
              error={fieldErrors.imageUrl}
              editable={!isLaunching}
              forceLtr
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="next"
              onSubmitEditing={() => originalPriceRef.current?.focus()}
            />

            <AppInput
              ref={originalPriceRef}
              testID="campaign-original-price-input"
              label={t.merchant.createCampaign.originalPriceLabel}
              placeholder={t.merchant.createCampaign.originalPricePlaceholder}
              hint={t.merchant.createCampaign.originalPriceHint}
              value={draft.originalPrice}
              onChangeText={(value) => updateField('originalPrice', value)}
              error={fieldErrors.originalPrice}
              editable={!isLaunching}
              forceLtr
              keyboardType="decimal-pad"
              returnKeyType="next"
              onSubmitEditing={() => discountPercentRef.current?.focus()}
            />

            <AppInput
              ref={discountPercentRef}
              testID="campaign-discount-percent-input"
              label={t.merchant.createCampaign.discountPercentLabel}
              placeholder={t.merchant.createCampaign.discountPercentPlaceholder}
              value={draft.discountPercent}
              onChangeText={(value) => updateField('discountPercent', value)}
              error={fieldErrors.discountPercent}
              editable={!isLaunching}
              forceLtr
              keyboardType="decimal-pad"
              returnKeyType="next"
              onSubmitEditing={() => commissionAmountRef.current?.focus()}
            />

            <AppInput
              ref={commissionAmountRef}
              testID="campaign-commission-amount-input"
              label={t.merchant.createCampaign.commissionAmountLabel}
              placeholder={t.merchant.createCampaign.commissionAmountPlaceholder}
              hint={t.merchant.createCampaign.commissionAmountHint}
              value={draft.commissionAmount}
              onChangeText={(value) => updateField('commissionAmount', value)}
              error={fieldErrors.commissionAmount}
              editable={!isLaunching}
              forceLtr
              keyboardType="decimal-pad"
              returnKeyType="next"
              onSubmitEditing={() => maxItemsRef.current?.focus()}
            />

            <AppInput
              ref={maxItemsRef}
              testID="campaign-max-items-input"
              label={t.merchant.createCampaign.maxItemsLabel}
              placeholder={t.merchant.createCampaign.maxItemsPlaceholder}
              value={draft.maxItems}
              onChangeText={(value) => updateField('maxItems', value)}
              error={fieldErrors.maxItems}
              editable={!isLaunching}
              forceLtr
              keyboardType="number-pad"
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
            />

            <View style={styles.endsAtSection}>
              <Text style={[Typography.label, directionalText]}>
                {t.merchant.createCampaign.endsAtLabel}
              </Text>

              <Pressable
                testID="campaign-ends-at-picker-button"
                disabled={isLaunching}
                onPress={handleOpenDatePicker}
                accessibilityRole="button"
                accessibilityLabel={
                  formattedEndsAt
                    ? `${t.merchant.createCampaign.endsAtLabel}: ${formattedEndsAt}`
                    : t.merchant.createCampaign.endsAtPlaceholder
                }
                accessibilityState={{ disabled: isLaunching, expanded: isDatePickerOpen }}
                style={({ pressed }) => [
                  styles.datePickerTrigger,
                  hasEndsAtError
                    ? styles.datePickerTriggerError
                    : isDatePickerOpen
                      ? styles.datePickerTriggerFocused
                      : null,
                  pressed && !isLaunching ? styles.datePickerTriggerPressed : null,
                  isLaunching ? styles.datePickerTriggerDisabled : null,
                ]}
              >
                <View style={styles.datePickerLeading}>
                  <CalendarGlyph disabled={isLaunching} />
                  <Text
                    style={[
                      Typography.body,
                      directionalText,
                      formattedEndsAt
                        ? styles.datePickerValueText
                        : styles.datePickerPlaceholderText,
                      styles.tabularNum,
                    ]}
                    numberOfLines={1}
                  >
                    {formattedEndsAt || t.merchant.createCampaign.endsAtPlaceholder}
                  </Text>
                </View>

                <Text
                  style={[
                    Typography.label,
                    styles.datePickerActionText,
                    isLaunching ? styles.mutedText : null,
                  ]}
                >
                  {t.merchant.createCampaign.endsAtSelectAction}
                </Text>
              </Pressable>

              {hasEndsAtError ? (
                <Text
                  accessibilityLiveRegion="polite"
                  style={[Typography.caption, directionalText, styles.dangerText]}
                >
                  {fieldErrors.endsAt}
                </Text>
              ) : (
                <Text style={[Typography.caption, directionalText, styles.mutedText]}>
                  {t.merchant.createCampaign.endsAtHint}
                </Text>
              )}
            </View>
          </View>

          <View testID="campaign-live-preview-card" style={styles.previewPanel}>
            <Text style={[Typography.section, directionalText]}>
              {t.merchant.createCampaign.previewTitle}
            </Text>

            {!hasCompletePreviewInputs ? (
              <Text style={[Typography.body, directionalText, styles.mutedText]}>
                {t.merchant.createCampaign.previewPrompt}
              </Text>
            ) : isPreviewLoading ? (
              <View style={styles.previewLoadingBox}>
                <View style={styles.previewLoadingRow}>
                  <ActivityIndicator size="small" color={Colors.action} />
                  <Text style={[Typography.label, directionalText, styles.mutedText]}>
                    {t.merchant.createCampaign.previewLoading}
                  </Text>
                </View>
                <SkeletonBlock height={76} borderRadius={Radii.control} />
              </View>
            ) : previewError ? (
              <View
                testID="campaign-preview-error-banner"
                style={[styles.dangerBanner, styles.previewErrorBanner]}
                accessibilityLiveRegion="polite"
              >
                <Text style={[Typography.label, directionalText, styles.dangerText]}>
                  {previewError}
                </Text>
                <View style={styles.previewRetryRow}>
                  <AppButton
                    testID="campaign-preview-retry-button"
                    variant="secondary"
                    fullWidth={false}
                    label={t.common.retry}
                    disabled={isLaunching}
                    onPress={retryPreview}
                  />
                </View>
              </View>
            ) : preview ? (
              <View style={styles.previewContent}>
                <View style={styles.previewSurface}>
                  <View style={styles.summaryRow}>
                    <Text style={[Typography.label, directionalText, styles.mutedText]}>
                      {t.merchant.createCampaign.previewFinalPrice}
                    </Text>
                    <Text style={[Typography.section, directionalText]}>
                      {formatSyp(
                        preview.finalPriceSyp ?? preview.sampleSaleAmountSyp,
                        locale,
                      )}
                    </Text>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.summaryRow}>
                    <Text style={[Typography.label, directionalText, styles.mutedText]}>
                      {t.merchant.createCampaign.previewWorstCaseReserve}
                    </Text>
                    <Text
                      style={[
                        Typography.section,
                        directionalText,
                        preview.isAffordableByMerchant
                          ? styles.highlightValue
                          : styles.dangerText,
                      ]}
                    >
                      {formatSyp(preview.worstCaseReserveSyp, locale)}
                    </Text>
                  </View>
                </View>

                <View style={styles.previewSurface}>
                  <Text style={[Typography.label, directionalText]}>
                    {t.merchant.createCampaign.previewPerSaleSection}
                  </Text>

                  <View style={styles.summaryRow}>
                    <Text style={[Typography.caption, directionalText]}>
                      {t.merchant.createCampaign.previewMarketerCommission}
                    </Text>
                    <Text style={[Typography.label, directionalText]}>
                      {formatSyp(preview.commissionPerUnitSyp, locale)}
                    </Text>
                  </View>

                  <View style={styles.summaryRow}>
                    <Text style={[Typography.caption, directionalText]}>
                      {t.merchant.createCampaign.previewPlatformFeeTotal}
                    </Text>
                    <Text style={[Typography.label, directionalText]}>
                      {formatSyp(preview.platformTotalFeeSampleSyp, locale)}
                    </Text>
                  </View>

                  <View style={styles.summaryRow}>
                    <Text style={[Typography.caption, directionalText]}>
                      {t.merchant.createCampaign.previewCustomerCashback}
                    </Text>
                    <Text style={[Typography.label, directionalText]}>
                      {formatSyp(preview.customerCashbackSampleSyp, locale)}
                    </Text>
                  </View>

                  <View style={styles.summaryRow}>
                    <Text style={[Typography.caption, directionalText]}>
                      {t.merchant.createCampaign.previewPlatformNetFee}
                    </Text>
                    <Text style={[Typography.label, directionalText]}>
                      {formatSyp(preview.platformNetFeeSampleSyp, locale)}
                    </Text>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.summaryRow}>
                    <Text style={[Typography.label, directionalText]}>
                      {t.merchant.createCampaign.previewMerchantNet}
                    </Text>
                    <Text style={[Typography.section, directionalText, styles.successText]}>
                      {formatSyp(preview.merchantNetSampleSyp, locale)}
                    </Text>
                  </View>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={[Typography.label, directionalText, styles.mutedText]}>
                    {t.merchant.createCampaign.previewAvailableBalance}
                  </Text>
                  <Text style={[Typography.label, directionalText]}>
                    {formatSyp(preview.merchantAvailableBalanceSyp, locale)}
                  </Text>
                </View>

                {!preview.isAffordableByMerchant ? (
                  <View
                    testID="campaign-insufficient-balance-banner"
                    style={styles.dangerBanner}
                    accessibilityLiveRegion="polite"
                  >
                    <Text style={[Typography.label, directionalText, styles.dangerText]}>
                      {t.merchant.createCampaign.insufficientBalanceBanner}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>

          {submitError ? (
            <View
              testID="campaign-submit-error-banner"
              style={styles.dangerBanner}
              accessibilityLiveRegion="polite"
            >
              <Text style={[Typography.label, directionalText, styles.dangerText]}>
                {submitError}
              </Text>
            </View>
          ) : null}

          <AppButton
            testID="merchant-campaign-launch-button"
            variant="primary"
            label={t.merchant.createCampaign.launchAction}
            loadingLabel={t.merchant.createCampaign.launchingAction}
            loading={isLaunching}
            disabled={isSubmitDisabled}
            haptic="medium"
            onPress={() => void submit()}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {isDatePickerOpen && Platform.OS === 'android' ? (
        <DateTimePicker
          testID="campaign-ends-at-android-picker"
          value={pickerEndDate}
          mode="date"
          display="calendar"
          design="material"
          title={t.merchant.createCampaign.endsAtLabel}
          minimumDate={minimumEndDate}
          firstDayOfWeek={locale === 'ar' ? 6 : 0}
          positiveButton={{
            label: t.common.confirm,
            textColor: Colors.action,
          }}
          negativeButton={{
            label: t.common.cancel,
            textColor: Colors.muted,
          }}
          onChange={handleAndroidDateChange}
        />
      ) : null}

      {Platform.OS === 'ios' ? (
        <Modal
          visible={isDatePickerOpen}
          transparent
          animationType="fade"
          onRequestClose={handleCloseIosPicker}
        >
          <View style={styles.iosModalBackdrop}>
            <View style={styles.iosModalCard}>
              <Text style={[Typography.section, directionalText]}>
                {t.merchant.createCampaign.endsAtLabel}
              </Text>

              <DateTimePicker
                testID="campaign-ends-at-ios-picker"
                value={iosDraftDate}
                mode="date"
                display="inline"
                locale={locale === 'ar' ? 'ar-SY' : 'en-US'}
                minimumDate={minimumEndDate}
                accentColor={Colors.action}
                themeVariant="light"
                onChange={handleIosDateChange}
              />

              <View style={styles.iosModalActions}>
                <View style={styles.iosModalActionSlot}>
                  <AppButton
                    variant="secondary"
                    label={t.common.cancel}
                    onPress={handleCloseIosPicker}
                  />
                </View>
                <View style={styles.iosModalActionSlot}>
                  <AppButton
                    variant="primary"
                    label={t.common.confirm}
                    onPress={handleConfirmIosDate}
                  />
                </View>
              </View>
            </View>
          </View>
        </Modal>
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.gutter,
    paddingTop: Spacing.gutter,
    paddingBottom: Spacing.section * 1.5,
    gap: Spacing.section,
  },
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.gutter,
    gap: Spacing.gutter,
  },
  multilineInput: {
    minHeight: 104,
    paddingTop: 12,
  },
  endsAtSection: {
    gap: Spacing.compact,
  },
  datePickerTrigger: {
    minHeight: TouchTarget.minHeight,
    backgroundColor: Colors.surface,
    borderRadius: Radii.control,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.controlBorder,
    paddingHorizontal: Spacing.gutter,
    paddingVertical: Spacing.compact + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.compact,
  },
  datePickerTriggerFocused: {
    borderColor: Colors.action,
    borderWidth: BorderWidth.focus,
  },
  datePickerTriggerError: {
    borderColor: Colors.danger,
    borderWidth: BorderWidth.focus,
  },
  datePickerTriggerPressed: {
    backgroundColor: Colors.mauveTint,
  },
  datePickerTriggerDisabled: {
    backgroundColor: Colors.mauveTint,
    opacity: 0.78,
  },
  datePickerLeading: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.compact + 2,
  },
  datePickerValueText: {
    flexShrink: 1,
    fontFamily: FontFamily.semiBold,
    color: Colors.ink,
  },
  datePickerPlaceholderText: {
    flexShrink: 1,
    color: Colors.muted,
  },
  datePickerActionText: {
    color: Colors.action,
  },
  calendarIconFrame: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarTabsRow: {
    width: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: -1,
    zIndex: 1,
  },
  calendarTabPin: {
    width: 2,
    height: 4,
    borderRadius: 1,
  },
  calendarBody: {
    width: 18,
    height: 16,
    borderRadius: 3,
    borderWidth: 1.6,
    overflow: 'hidden',
    alignItems: 'center',
  },
  calendarHeaderBar: {
    width: '100%',
    height: 4,
  },
  calendarDayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 3,
  },
  iosModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(80, 60, 68, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.gutter,
  },
  iosModalCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.gutter,
    gap: Spacing.gutter,
  },
  iosModalActions: {
    flexDirection: 'row',
    gap: Spacing.compact,
  },
  iosModalActionSlot: {
    flex: 1,
  },
  previewPanel: {
    backgroundColor: Colors.mauveTint,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.gutter,
    gap: Spacing.compact + 4,
  },
  previewLoadingBox: {
    gap: Spacing.compact + 2,
  },
  previewLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.compact,
  },
  previewContent: {
    gap: Spacing.compact + 4,
  },
  previewSurface: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.control,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.compact + 4,
    gap: Spacing.compact + 2,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.compact,
  },
  divider: {
    height: BorderWidth.hairline,
    backgroundColor: Colors.rule,
  },
  highlightValue: {
    color: Colors.action,
  },
  successText: {
    color: Colors.success,
  },
  dangerBanner: {
    backgroundColor: Colors.dangerBg,
    borderRadius: Radii.control,
    borderWidth: BorderWidth.hairline,
    borderColor: 'rgba(152, 45, 61, 0.25)',
    padding: Spacing.compact + 4,
  },
  previewErrorBanner: {
    gap: Spacing.compact,
  },
  previewRetryRow: {
    alignItems: 'flex-start',
  },
  dangerText: {
    color: Colors.danger,
  },
  mutedText: {
    color: Colors.muted,
  },
  tabularNum: {
    fontVariant: ['tabular-nums'],
  },
});
