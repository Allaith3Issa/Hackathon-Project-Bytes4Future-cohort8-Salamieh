import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { useLocale } from '@/core/i18n';
import { getDirectionalTextStyle, LtrTextStyle } from '@/core/rtl';
import {
  BorderWidth,
  Colors,
  FontFamily,
  Radii,
  Spacing,
  TouchTarget,
  Typography,
} from '@/core/theme';
import { AppButton } from './AppButton';

export interface QrCodeBoxProps {
  qrToken?: string | null;
  passCode?: string | null;
  passCodeLabel?: string;
  size?: number;
  showCopyButton?: boolean;
  copyLabel?: string;
  copiedLabel?: string;
  onCopyPassCode?: (passCode: string) => void;
  unavailableMessage?: string;
  helperText?: string;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

const DEFAULT_QR_SIZE = 200;
const QR_QUIET_ZONE = 12;
const MIN_QR_SIZE = 116;

export function QrCodeBox({
  qrToken,
  passCode,
  passCodeLabel,
  size = DEFAULT_QR_SIZE,
  showCopyButton = false,
  copyLabel,
  copiedLabel,
  onCopyPassCode,
  unavailableMessage,
  helperText,
  accessibilityLabel,
  testID,
  style,
}: QrCodeBoxProps) {
  const { locale, t } = useLocale();
  const { width: windowWidth } = useWindowDimensions();
  const [failedToken, setFailedToken] = useState<string | null>(null);
  const [hasCopied, setHasCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const normalizedToken = qrToken?.trim() ?? '';
  const normalizedPassCode = passCode?.trim() ?? '';
  const hasQrError = normalizedToken.length > 0 && failedToken === normalizedToken;
  const canRenderQr = normalizedToken.length > 0 && !hasQrError;
  const directionalText = getDirectionalTextStyle(locale);

  const resolvedUnavailableMessage =
    unavailableMessage ?? t.qrCodeBox.unavailableMessage;

  const resolvedCopyLabel = copyLabel ?? t.qrCodeBox.copyCodeAction;

  const resolvedCopiedLabel = copiedLabel ?? t.qrCodeBox.copiedCodeAction;

  const resolvedAccessibilityLabel =
    accessibilityLabel ??
    (normalizedPassCode
      ? `${t.qrCodeBox.offerCodeAccessibilityPrefix} ${normalizedPassCode}`
      : t.qrCodeBox.defaultAccessibilityLabel);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
        copyTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = null;
    }
    setHasCopied(false);
  }, [normalizedPassCode]);

  const handleQrError = useCallback(() => {
    if (normalizedToken) {
      setFailedToken(normalizedToken);
    }
  }, [normalizedToken]);

  const handleCopyPassCode = useCallback(async () => {
    if (!normalizedPassCode) {
      return;
    }

    const copiedPassCode = normalizedPassCode;

    try {
      await Clipboard.setStringAsync(copiedPassCode);
      if (!isMountedRef.current) {
        return;
      }

      setHasCopied(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
      onCopyPassCode?.(copiedPassCode);

      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = setTimeout(() => {
        copyTimerRef.current = null;
        if (isMountedRef.current) {
          setHasCopied(false);
        }
      }, 2200);
    } catch {
      if (isMountedRef.current) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
          () => undefined,
        );
      }
    }
  }, [normalizedPassCode, onCopyPassCode]);

  const horizontalChromeWidth =
    Spacing.gutter * 4 + Spacing.section * 2 + Spacing.compact * 2 + 8;
  const maxQrDimension = Math.max(
    MIN_QR_SIZE + QR_QUIET_ZONE * 2,
    Math.floor(windowWidth - horizontalChromeWidth),
  );
  const maxQrSize = Math.max(MIN_QR_SIZE, maxQrDimension - QR_QUIET_ZONE * 2);
  const effectiveQrSize = Math.min(size, maxQrSize);
  const qrBoxDimension = effectiveQrSize + QR_QUIET_ZONE * 2;

  return (
    <View
      testID={testID}
      accessibilityLabel={resolvedAccessibilityLabel}
      style={[styles.card, style]}
    >
      <View style={styles.qrFrame}>
        {canRenderQr ? (
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={resolvedAccessibilityLabel}
            style={[
              styles.qrCanvas,
              {
                width: qrBoxDimension,
                minHeight: qrBoxDimension,
              },
            ]}
          >
            <QRCode
              value={normalizedToken}
              size={effectiveQrSize}
              color={Colors.ink}
              backgroundColor={Colors.surface}
              quietZone={QR_QUIET_ZONE}
              ecl="M"
              onError={handleQrError}
              testID={testID ? `${testID}-svg` : undefined}
            />
          </View>
        ) : (
          <View
            accessible
            accessibilityRole="text"
            accessibilityLabel={resolvedUnavailableMessage}
            style={[
              styles.fallbackBox,
              {
                width: qrBoxDimension,
                minHeight: qrBoxDimension,
              },
            ]}
          >
            <Text style={[Typography.caption, styles.fallbackText]}>
              {resolvedUnavailableMessage}
            </Text>
          </View>
        )}
      </View>

      {normalizedPassCode ? (
        <View style={styles.passCodeSection}>
          {passCodeLabel ? (
            <Text style={[Typography.caption, directionalText, styles.passCodeLabel]}>
              {passCodeLabel}
            </Text>
          ) : null}

          <View style={styles.passCodeContainer}>
            <Text
              selectable
              testID={testID ? `${testID}-pass-code` : undefined}
              style={[styles.passCodeText, LtrTextStyle]}
            >
              {normalizedPassCode}
            </Text>
          </View>

          {showCopyButton ? (
            <AppButton
              testID={testID ? `${testID}-copy-button` : undefined}
              label={hasCopied ? resolvedCopiedLabel : resolvedCopyLabel}
              variant={hasCopied ? 'ghost' : 'secondary'}
              fullWidth
              onPress={() => {
                void handleCopyPassCode();
              }}
            />
          ) : null}
        </View>
      ) : null}

      {helperText ? (
        <Text style={[Typography.caption, directionalText, styles.helperText]}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.section,
    alignItems: 'center',
    gap: Spacing.gutter,
  },
  qrFrame: {
    maxWidth: '100%',
    backgroundColor: Colors.surface,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.compact,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCanvas: {
    maxWidth: '100%',
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackBox: {
    maxWidth: '100%',
    backgroundColor: Colors.canvas,
    borderRadius: Radii.control,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.gutter,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    color: Colors.muted,
    textAlign: 'center',
  },
  passCodeSection: {
    width: '100%',
    gap: Spacing.compact,
    alignItems: 'center',
  },
  passCodeLabel: {
    color: Colors.muted,
    width: '100%',
    textAlign: 'center',
  },
  passCodeContainer: {
    width: '100%',
    minHeight: TouchTarget.minHeight,
    backgroundColor: Colors.canvas,
    borderRadius: Radii.control,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    paddingHorizontal: Spacing.gutter,
    paddingVertical: Spacing.compact,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passCodeText: {
    fontFamily: FontFamily.bold,
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: 1.5,
    color: Colors.ink,
  },
  helperText: {
    color: Colors.muted,
    width: '100%',
  },
});
