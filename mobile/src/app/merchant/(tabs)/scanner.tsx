import { CameraView, useCameraPermissions } from 'expo-camera';
import type { BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useIsFocused } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import {
  ActivityIndicator,
  AppState,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { AppStateStatus } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, AppInput, StatusBadge } from '@/components/ui';
import { useAuth } from '@/core/auth';
import type { VerificationStatus } from '@/core/auth';
import { useLocale } from '@/core/i18n';
import type { AppLocale } from '@/core/i18n';
import { useAndroidBack } from '@/core/navigation';
import {
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
  Typography,
} from '@/core/theme';
import { useAccountRefresh } from '@/features/auth';
import {
  SCANNER_CODE_MAX_LENGTH,
  useMerchantScanner,
} from '@/features/merchant/scanner';

const BARCODE_COOLDOWN_MS = 1800;

function formatSettlementTimestamp(isoDate: string, locale: AppLocale): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }

  try {
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SY' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(parsed);
  } catch {
    return parsed.toISOString().slice(0, 16).replace('T', ' ');
  }
}

export default function MerchantScannerScreen() {
  const { locale, t } = useLocale();
  const { user } = useAuth();
  const { refreshAccount } = useAccountRefresh();
  const isFocused = useIsFocused();
  const reducedMotion = useReducedMotion();

  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [cameraMountFailed, setCameraMountFailed] = useState(false);

  const isMountedRef = useRef(true);
  const scrollViewRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const manualInputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCapturedBarcodeRef = useRef<{ data: string; at: number } | null>(null);
  const scanCaptureLockRef = useRef(false);

  const {
    status,
    manualCode,
    activeCode,
    lookupResult,
    redeemResult,
    errorMessage,
    isBusy,
    setManualCodeInput,
    lookupCode,
    confirmRedeem,
    resetScanner,
  } = useMerchantScanner();

  const verificationStatus: VerificationStatus =
    user?.merchant?.verificationStatus ?? 'pending';
  const isVerified = verificationStatus === 'verified';

  const hasPreview = Boolean(lookupResult && status !== 'redeemed');
  const hasRedeemed = Boolean(status === 'redeemed' && redeemResult);
  const hasStandaloneError = Boolean(status === 'error' && !lookupResult && errorMessage);

  const isCameraLive =
    isFocused &&
    appState === 'active' &&
    isVerified &&
    Boolean(permission?.granted) &&
    !cameraMountFailed &&
    isCameraEnabled &&
    status === 'idle';

  const effectiveTorchOn = isCameraLive && isTorchOn;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (focusTimerRef.current) {
        clearTimeout(focusTimerRef.current);
        focusTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setAppState(AppState.currentState);
    const subscription = AppState.addEventListener('change', (nextState) => {
      setAppState(nextState);
      if (nextState !== 'active') {
        setIsTorchOn(false);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!isFocused) {
      setIsTorchOn(false);
    }
  }, [isFocused]);

  useEffect(() => {
    if (!isBusy) {
      scanCaptureLockRef.current = false;
    }
  }, [isBusy]);

  useEffect(() => {
    if (!isFocused) {
      return undefined;
    }

    if (permission && !permission.granted) {
      void getPermission().catch(() => undefined);
    }

    if (!isVerified) {
      void refreshAccount();
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void getPermission().catch(() => undefined);
        if (!isVerified) {
          void refreshAccount();
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [getPermission, isFocused, isVerified, permission, refreshAccount]);

  useEffect(() => {
    if (hasPreview || hasRedeemed) {
      scrollViewRef.current?.scrollTo({
        y: 0,
        animated: !reducedMotion,
      });
    }
  }, [hasPreview, hasRedeemed, reducedMotion]);

  const handleResetToScan = useCallback(
    (focusManualIfCameraUnavailable = false) => {
      Keyboard.dismiss();
      if (focusTimerRef.current) {
        clearTimeout(focusTimerRef.current);
        focusTimerRef.current = null;
      }
      lastCapturedBarcodeRef.current = null;
      scanCaptureLockRef.current = false;
      setIsTorchOn(false);
      resetScanner();

      if (permission?.granted && !cameraMountFailed) {
        setIsCameraEnabled(true);
      } else if (focusManualIfCameraUnavailable) {
        focusTimerRef.current = setTimeout(() => {
          focusTimerRef.current = null;
          if (isMountedRef.current) {
            manualInputRef.current?.focus();
          }
        }, 80);
      }

      scrollViewRef.current?.scrollTo({
        y: 0,
        animated: !reducedMotion,
      });
    },
    [cameraMountFailed, permission?.granted, reducedMotion, resetScanner],
  );

  const handleAndroidBack = useCallback((): boolean => {
    if (hasPreview || hasRedeemed || hasStandaloneError) {
      handleResetToScan(false);
      return true;
    }
    return false;
  }, [handleResetToScan, hasPreview, hasRedeemed, hasStandaloneError]);

  useAndroidBack({
    enabled: isFocused,
    isBusy,
    isRootTab: true,
    onBack: handleAndroidBack,
  });

  const handleBarcodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (!isCameraLive || isBusy || scanCaptureLockRef.current) {
        return;
      }

      const rawData = result.data?.trim() ?? '';
      if (!rawData) {
        return;
      }

      const now = Date.now();
      const lastCaptured = lastCapturedBarcodeRef.current;
      if (
        lastCaptured &&
        lastCaptured.data === rawData &&
        now - lastCaptured.at < BARCODE_COOLDOWN_MS
      ) {
        return;
      }

      lastCapturedBarcodeRef.current = { data: rawData, at: now };
      scanCaptureLockRef.current = true;
      setIsTorchOn(false);
      Keyboard.dismiss();

      void lookupCode(rawData, 'camera').finally(() => {
        scanCaptureLockRef.current = false;
      });
    },
    [isBusy, isCameraLive, lookupCode],
  );

  const handleCameraMountError = useCallback(() => {
    setCameraMountFailed(true);
    setIsTorchOn(false);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
      () => undefined,
    );
  }, []);

  const handleToggleCamera = useCallback(() => {
    if (isBusy) {
      return;
    }
    if (status !== 'idle') {
      handleResetToScan(false);
      return;
    }
    if (!isCameraEnabled) {
      lastCapturedBarcodeRef.current = null;
      setIsCameraEnabled(true);
      return;
    }
    setIsTorchOn(false);
    setIsCameraEnabled(false);
  }, [handleResetToScan, isBusy, isCameraEnabled, status]);

  const handleToggleTorch = useCallback(() => {
    if (!isCameraLive) {
      return;
    }
    setIsTorchOn((prev) => !prev);
  }, [isCameraLive]);

  const handleRequestCameraPermission = useCallback(async () => {
    setCameraMountFailed(false);
    const response = await requestPermission();
    if (response.granted) {
      setIsCameraEnabled(true);
    }
  }, [requestPermission]);

  const handleOpenSettings = useCallback(() => {
    void Linking.openSettings().catch(() => undefined);
  }, []);

  const handleManualLookup = useCallback(() => {
    if (!isVerified || isBusy) {
      return;
    }
    setIsTorchOn(false);
    Keyboard.dismiss();
    void lookupCode(manualCode, 'manual');
  }, [isBusy, isVerified, lookupCode, manualCode]);

  const handleConfirmRedeem = useCallback(() => {
    if (!isVerified || isBusy) {
      return;
    }
    Keyboard.dismiss();
    void confirmRedeem();
  }, [confirmRedeem, isBusy, isVerified]);

  const directionalText = getDirectionalTextStyle(locale);

  const cashDueSyp = lookupResult
    ? (lookupResult.availableQuantityOptions[0]?.customerPaidCashSyp ??
      lookupResult.finalPriceSyp ??
      0)
    : 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerBlock}>
            <View style={styles.titleRow}>
              <Text style={[Typography.display, directionalText, styles.screenTitle]}>
                {t.merchant.scanner.screenTitle}
              </Text>
              <StatusBadge label={t.profile.roleMerchant} tone="mauve" showDot />
            </View>

            {!isVerified ? (
              <View
                testID="merchant-scanner-unverified-banner"
                style={styles.dangerBanner}
                accessibilityLiveRegion="polite"
              >
                <Text style={[Typography.label, directionalText, styles.dangerText]}>
                  {t.merchant.scanner.unverifiedNotice}
                </Text>
              </View>
            ) : null}
          </View>

          {hasRedeemed && redeemResult ? (
            <View
              testID="merchant-scanner-redeemed-card"
              style={styles.redeemedContainer}
            >
              <View style={styles.successBanner} accessibilityLiveRegion="polite">
                <Text style={[Typography.section, directionalText, styles.successText]}>
                  {t.merchant.scanner.redeemedTitle}
                </Text>
                <Text style={[Typography.body, directionalText, styles.successBodyText]}>
                  {t.merchant.scanner.redeemedSubtitle}
                </Text>
              </View>

              {redeemResult.campaignStatusAfterSale === 'ended' ? (
                <View
                  testID="merchant-scanner-campaign-ended-alert"
                  style={styles.endedNoticeBanner}
                  accessibilityLiveRegion="polite"
                >
                  <StatusBadge
                    label={t.campaigns.endedStatus}
                    tone="action"
                    showDot
                  />
                  <Text style={[Typography.label, directionalText, styles.endedNoticeText]}>
                    {t.merchant.scanner.campaignClosedAfterSaleBanner}
                  </Text>
                </View>
              ) : null}

              <View style={styles.surfaceCard}>
                <View style={styles.summaryRow}>
                  <Text style={[Typography.label, directionalText, styles.mutedText]}>
                    {t.merchant.scanner.saleIdLabel}
                  </Text>
                  <Text selectable style={[Typography.label, LtrTextStyle]}>
                    {redeemResult.saleId}
                  </Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.summaryRow}>
                  <Text style={[Typography.label, directionalText, styles.mutedText]}>
                    {t.merchant.scanner.previewProductLabel}
                  </Text>
                  <Text style={[Typography.label, directionalText, styles.valueEnd]}>
                    {redeemResult.productName}
                  </Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.summaryRow}>
                  <Text style={[Typography.label, directionalText, styles.mutedText]}>
                    {t.merchant.scanner.originalAmountLabel}
                  </Text>
                  <Text style={[Typography.label, directionalText]}>
                    {formatSyp(redeemResult.originalAmountSyp, locale)}
                  </Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.summaryRow}>
                  <Text style={[Typography.label, directionalText]}>
                    {t.merchant.scanner.cashPaidLabel}
                  </Text>
                  <Text style={[Typography.section, directionalText, styles.highlightValue]}>
                    {formatSyp(redeemResult.customerPaidCashSyp, locale)}
                  </Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.summaryRow}>
                  <Text style={[Typography.caption, directionalText]}>
                    {t.merchant.scanner.commissionLabel}
                  </Text>
                  <Text style={[Typography.label, directionalText]}>
                    {formatSyp(redeemResult.marketerCommissionSyp, locale)}
                  </Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={[Typography.caption, directionalText]}>
                    {t.merchant.scanner.platformTotalFeeLabel}
                  </Text>
                  <Text style={[Typography.label, directionalText]}>
                    {formatSyp(redeemResult.platformTotalFeeSyp, locale)}
                  </Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={[Typography.caption, directionalText]}>
                    {t.merchant.scanner.customerCashbackLabel}
                  </Text>
                  <Text style={[Typography.label, directionalText]}>
                    {formatSyp(redeemResult.customerCashbackSyp, locale)}
                  </Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={[Typography.caption, directionalText]}>
                    {t.merchant.scanner.platformNetFeeLabel}
                  </Text>
                  <Text style={[Typography.label, directionalText]}>
                    {formatSyp(redeemResult.platformNetFeeSyp, locale)}
                  </Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.summaryRow}>
                  <Text style={[Typography.label, directionalText, styles.mutedText]}>
                    {t.merchant.scanner.remainingReserveLabel}
                  </Text>
                  <Text style={[Typography.section, directionalText, styles.successText]}>
                    {formatSyp(redeemResult.remainingLockedBudgetSyp, locale)}
                  </Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.summaryRow}>
                  <Text style={[Typography.label, directionalText, styles.mutedText]}>
                    {t.merchant.scanner.campaignStatusAfterLabel}
                  </Text>
                  <StatusBadge
                    label={
                      redeemResult.campaignStatusAfterSale === 'active'
                        ? t.campaigns.activeStatus
                        : t.campaigns.endedStatus
                    }
                    tone={
                      redeemResult.campaignStatusAfterSale === 'active'
                        ? 'success'
                        : 'info'
                    }
                    showDot
                  />
                </View>

                <View style={styles.summaryRow}>
                  <Text style={[Typography.caption, directionalText]}>
                    {t.merchant.scanner.scannedAtLabel}
                  </Text>
                  <Text style={[Typography.caption, directionalText]}>
                    {formatSettlementTimestamp(redeemResult.scannedAt, locale)}
                  </Text>
                </View>
              </View>

              <AppButton
                testID="merchant-scanner-scan-next-button"
                variant="primary"
                label={t.merchant.scanner.scanNextAction}
                haptic="light"
                onPress={() => handleResetToScan(true)}
              />
            </View>
          ) : hasPreview && lookupResult ? (
            <View
              testID="merchant-scanner-preview-card"
              style={styles.previewCard}
            >
              <View style={styles.previewHeaderRow}>
                <Text style={[Typography.section, directionalText, styles.flexTitle]}>
                  {t.merchant.scanner.previewTitle}
                </Text>
                {activeCode ? (
                  <StatusBadge label={activeCode} tone="mauve" forceLtr />
                ) : null}
              </View>

              <View style={styles.cashDuePanel}>
                <Text style={[Typography.caption, directionalText, styles.cashDueLabel]}>
                  {t.merchant.scanner.previewCashDueLabel}
                </Text>
                <Text style={[Typography.balance, directionalText, styles.cashDueAmount]}>
                  {formatSyp(cashDueSyp, locale)}
                </Text>
                <Text style={[Typography.caption, directionalText, styles.cashDueHint]}>
                  {t.merchant.scanner.previewCashDueHint}
                </Text>
              </View>

              <View style={styles.detailsSurface}>
                {activeCode ? (
                  <>
                    <View style={styles.summaryRow}>
                      <Text style={[Typography.label, directionalText, styles.mutedText]}>
                        {t.merchant.scanner.previewCodeLabel}
                      </Text>
                      <Text selectable style={[Typography.label, LtrTextStyle]}>
                        {activeCode}
                      </Text>
                    </View>
                    <View style={styles.divider} />
                  </>
                ) : null}

                <View style={styles.summaryRow}>
                  <Text style={[Typography.label, directionalText, styles.mutedText]}>
                    {t.merchant.scanner.previewCustomerLabel}
                  </Text>
                  <Text style={[Typography.label, directionalText, styles.valueEnd]}>
                    {lookupResult.customerName}
                  </Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.summaryRow}>
                  <Text style={[Typography.label, directionalText, styles.mutedText]}>
                    {t.merchant.scanner.previewProductLabel}
                  </Text>
                  <Text style={[Typography.label, directionalText, styles.valueEnd]}>
                    {lookupResult.productName}
                  </Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.summaryRow}>
                  <Text style={[Typography.label, directionalText, styles.mutedText]}>
                    {t.merchant.scanner.previewDiscountLabel}
                  </Text>
                  <Text style={[Typography.label, directionalText]}>
                    {formatPercent(lookupResult.discountPercent, locale)}
                  </Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.summaryRow}>
                  <Text style={[Typography.label, directionalText, styles.mutedText]}>
                    {t.merchant.scanner.previewQuantityLabel}
                  </Text>
                  <Text style={[Typography.label, directionalText]}>
                    {t.merchant.scanner.previewQuantitySingleValue}
                  </Text>
                </View>
              </View>

              {errorMessage ? (
                <View
                  testID="merchant-scanner-redeem-error-banner"
                  style={styles.dangerBanner}
                  accessibilityLiveRegion="polite"
                >
                  <Text style={[Typography.label, directionalText, styles.dangerText]}>
                    {errorMessage}
                  </Text>
                </View>
              ) : null}

              <View style={styles.previewActions}>
                <AppButton
                  testID="merchant-scanner-confirm-redeem-button"
                  variant="primary"
                  label={t.merchant.scanner.confirmRedeemAction}
                  loadingLabel={t.merchant.scanner.redeemingAction}
                  loading={status === 'redeeming'}
                  disabled={!isVerified || isBusy}
                  haptic="medium"
                  onPress={handleConfirmRedeem}
                />
                <AppButton
                  testID="merchant-scanner-cancel-preview-button"
                  variant="secondary"
                  label={t.merchant.scanner.cancelScanAction}
                  disabled={isBusy}
                  onPress={() => handleResetToScan(false)}
                />
              </View>
            </View>
          ) : (
            <View style={styles.surfaceCard}>
              <View style={styles.cameraHeaderRow}>
                <Text style={[Typography.section, directionalText, styles.flexTitle]}>
                  {t.merchant.scanner.cameraTitle}
                </Text>
              </View>

              {!isVerified ? (
                <View style={styles.cameraFallbackBox}>
                  <Text style={[Typography.label, directionalText, styles.mutedText]}>
                    {t.merchant.scanner.cameraUnavailableFallback}
                  </Text>
                </View>
              ) : !permission ? (
                <View style={styles.cameraFallbackBox}>
                  <ActivityIndicator size="small" color={Colors.action} />
                  <Text style={[Typography.body, directionalText, styles.mutedText]}>
                    {t.merchant.scanner.cameraPermissionChecking}
                  </Text>
                </View>
              ) : cameraMountFailed || !permission.granted ? (
                <View
                  testID="merchant-scanner-permission-fallback"
                  style={styles.cameraFallbackBox}
                >
                  <Text style={[Typography.label, directionalText, styles.permissionTitle]}>
                    {cameraMountFailed || !permission.canAskAgain
                      ? t.merchant.scanner.cameraUnavailableFallback
                      : t.merchant.scanner.cameraPermissionTitle}
                  </Text>
                  <Text style={[Typography.body, directionalText, styles.mutedText]}>
                    {t.merchant.scanner.cameraPermissionMessage}
                  </Text>
                  {!cameraMountFailed ? (
                    permission.canAskAgain ? (
                      <AppButton
                        testID="merchant-scanner-grant-camera-button"
                        variant="secondary"
                        label={t.merchant.scanner.grantCameraPermissionAction}
                        onPress={() => void handleRequestCameraPermission()}
                      />
                    ) : (
                      <AppButton
                        testID="merchant-scanner-open-settings-button"
                        variant="secondary"
                        label={t.merchant.scanner.openSettingsAction}
                        onPress={handleOpenSettings}
                      />
                    )
                  ) : null}
                </View>
              ) : (
                <View style={styles.cameraSectionBody}>
                  <View style={styles.viewfinderContainer}>
                    {isCameraLive ? (
                      <>
                        <CameraView
                          style={styles.cameraPreview}
                          facing="back"
                          enableTorch={effectiveTorchOn}
                          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                          onBarcodeScanned={handleBarcodeScanned}
                          onMountError={handleCameraMountError}
                        />
                        <View pointerEvents="none" style={styles.reticleOverlay}>
                          <View style={styles.reticleBox}>
                            <View style={[styles.corner, styles.cornerTopStart]} />
                            <View style={[styles.corner, styles.cornerTopEnd]} />
                            <View style={[styles.corner, styles.cornerBottomStart]} />
                            <View style={[styles.corner, styles.cornerBottomEnd]} />
                          </View>
                          <View style={styles.hintPill}>
                            <Text style={[Typography.caption, directionalText, styles.hintPillText]}>
                              {t.merchant.scanner.cameraHint}
                            </Text>
                          </View>
                        </View>
                      </>
                    ) : (
                      <View style={styles.cameraPausedPlaceholder}>
                        {status === 'looking_up' ? (
                          <ActivityIndicator size="small" color={Colors.action} />
                        ) : null}
                        <Text style={[Typography.body, directionalText, styles.pausedHintText]}>
                          {status === 'looking_up'
                            ? t.merchant.scanner.lookingUpAction
                            : status === 'error'
                              ? t.merchant.scanner.cameraErrorHint
                              : isCameraEnabled
                                ? t.merchant.scanner.cameraPausedHint
                                : t.merchant.scanner.cameraStoppedHint}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.cameraControlsRow}>
                    <View style={styles.cameraControlCol}>
                      <AppButton
                        testID="merchant-scanner-toggle-camera-button"
                        variant="secondary"
                        label={
                          status !== 'idle'
                            ? t.merchant.scanner.rescanAction
                            : isCameraEnabled
                              ? t.merchant.scanner.pauseCameraAction
                              : t.merchant.scanner.startCameraAction
                        }
                        disabled={isBusy}
                        onPress={handleToggleCamera}
                      />
                    </View>
                    <View style={styles.cameraControlCol}>
                      <AppButton
                        testID="merchant-scanner-toggle-torch-button"
                        variant="secondary"
                        label={
                          effectiveTorchOn
                            ? t.merchant.scanner.torchOnAction
                            : t.merchant.scanner.torchOffAction
                        }
                        disabled={!isCameraLive}
                        onPress={handleToggleTorch}
                      />
                    </View>
                  </View>
                </View>
              )}
            </View>
          )}

          {hasStandaloneError && errorMessage ? (
            <View
              testID="merchant-scanner-error-banner"
              style={styles.dangerBanner}
              accessibilityLiveRegion="polite"
            >
              <Text style={[Typography.label, directionalText, styles.dangerText]}>
                {errorMessage}
              </Text>
              {permission?.granted && !cameraMountFailed ? (
                <View style={styles.errorRetryRow}>
                  <AppButton
                    testID="merchant-scanner-resume-after-error-button"
                    variant="secondary"
                    fullWidth={false}
                    label={t.merchant.scanner.rescanAction}
                    onPress={() => handleResetToScan(false)}
                  />
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.surfaceCard}>
            <Text style={[Typography.section, directionalText]}>
              {t.merchant.scanner.manualSectionTitle}
            </Text>

            <AppInput
              ref={manualInputRef}
              testID="merchant-scanner-manual-code-input"
              label={t.merchant.scanner.manualCodeLabel}
              placeholder={t.merchant.scanner.manualCodePlaceholder}
              hint={t.merchant.scanner.manualCodeHint}
              value={manualCode}
              onChangeText={setManualCodeInput}
              editable={isVerified && !isBusy}
              forceLtr
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={SCANNER_CODE_MAX_LENGTH}
              returnKeyType="search"
              onSubmitEditing={handleManualLookup}
            />

            <AppButton
              testID="merchant-scanner-manual-lookup-button"
              variant={hasPreview || hasRedeemed ? 'secondary' : 'primary'}
              label={t.merchant.scanner.lookupAction}
              loadingLabel={t.merchant.scanner.lookingUpAction}
              loading={status === 'looking_up'}
              disabled={!isVerified || isBusy || manualCode.trim().length === 0}
              haptic="light"
              onPress={handleManualLookup}
            />
          </View>
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
    flexGrow: 1,
    paddingHorizontal: Spacing.gutter,
    paddingTop: Spacing.gutter,
    paddingBottom: Spacing.section * 1.5,
    gap: Spacing.section,
  },
  headerBlock: {
    gap: Spacing.compact + 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.compact,
  },
  screenTitle: {
    flexShrink: 1,
  },
  flexTitle: {
    flex: 1,
    flexShrink: 1,
  },
  surfaceCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.gutter,
    gap: Spacing.gutter,
  },
  cameraHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.compact,
  },
  cameraSectionBody: {
    gap: Spacing.compact + 4,
  },
  viewfinderContainer: {
    width: '100%',
    height: 276,
    borderRadius: Radii.panel,
    overflow: 'hidden',
    backgroundColor: Colors.ink,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
  },
  cameraPreview: {
    width: '100%',
    height: '100%',
  },
  reticleOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    start: 0,
    end: 0,
    backgroundColor: 'rgba(80, 60, 68, 0.24)',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.gutter,
  },
  reticleBox: {
    width: 184,
    height: 184,
    marginTop: Spacing.xs,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: Colors.action,
  },
  cornerTopStart: {
    top: 0,
    start: 0,
    borderTopWidth: 4,
    borderStartWidth: 4,
    borderTopStartRadius: Radii.control,
  },
  cornerTopEnd: {
    top: 0,
    end: 0,
    borderTopWidth: 4,
    borderEndWidth: 4,
    borderTopEndRadius: Radii.control,
  },
  cornerBottomStart: {
    bottom: 0,
    start: 0,
    borderBottomWidth: 4,
    borderStartWidth: 4,
    borderBottomStartRadius: Radii.control,
  },
  cornerBottomEnd: {
    bottom: 0,
    end: 0,
    borderBottomWidth: 4,
    borderEndWidth: 4,
    borderBottomEndRadius: Radii.control,
  },
  hintPill: {
    backgroundColor: 'rgba(80, 60, 68, 0.86)',
    borderRadius: Radii.control,
    paddingHorizontal: Spacing.compact + 4,
    paddingVertical: Spacing.xs + 2,
  },
  hintPillText: {
    color: Colors.onInk,
    textAlign: 'center',
  },
  cameraPausedPlaceholder: {
    flex: 1,
    backgroundColor: Colors.mauveTint,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.section,
    gap: Spacing.compact + 2,
  },
  pausedHintText: {
    color: Colors.ink,
    textAlign: 'center',
  },
  cameraFallbackBox: {
    backgroundColor: Colors.mauveTint,
    borderRadius: Radii.control,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.gutter,
    gap: Spacing.compact + 4,
  },
  permissionTitle: {
    color: Colors.ink,
    fontFamily: FontFamily.bold,
  },
  cameraControlsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.compact + 4,
  },
  cameraControlCol: {
    flex: 1,
    minWidth: 140,
  },
  previewCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.focus,
    borderColor: Colors.action,
    padding: Spacing.gutter,
    gap: Spacing.gutter,
  },
  previewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.compact,
  },
  cashDuePanel: {
    backgroundColor: Colors.ink,
    borderRadius: Radii.panel,
    padding: Spacing.gutter,
    gap: Spacing.xs + 2,
  },
  cashDueLabel: {
    color: Colors.mauveTint,
  },
  cashDueAmount: {
    color: Colors.onInk,
  },
  cashDueHint: {
    color: Colors.mauveTint,
  },
  detailsSurface: {
    backgroundColor: Colors.canvas,
    borderRadius: Radii.control,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.compact + 4,
    gap: Spacing.compact + 2,
  },
  previewActions: {
    gap: Spacing.compact + 4,
  },
  redeemedContainer: {
    gap: Spacing.gutter,
  },
  successBanner: {
    backgroundColor: Colors.successBg,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: 'rgba(49, 93, 71, 0.25)',
    padding: Spacing.gutter,
    gap: Spacing.xs,
  },
  successText: {
    color: Colors.success,
  },
  successBodyText: {
    color: Colors.ink,
  },
  endedNoticeBanner: {
    backgroundColor: Colors.mauveTint,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.focus,
    borderColor: Colors.action,
    padding: Spacing.gutter,
    gap: Spacing.compact,
    alignItems: 'flex-start',
  },
  endedNoticeText: {
    color: Colors.ink,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.compact,
  },
  valueEnd: {
    flexShrink: 1,
  },
  highlightValue: {
    color: Colors.action,
  },
  divider: {
    height: BorderWidth.hairline,
    backgroundColor: Colors.rule,
  },
  dangerBanner: {
    backgroundColor: Colors.dangerBg,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: 'rgba(152, 45, 61, 0.25)',
    padding: Spacing.gutter,
    gap: Spacing.compact + 2,
  },
  dangerText: {
    color: Colors.danger,
  },
  errorRetryRow: {
    alignItems: 'flex-start',
  },
  mutedText: {
    color: Colors.muted,
  },
});
