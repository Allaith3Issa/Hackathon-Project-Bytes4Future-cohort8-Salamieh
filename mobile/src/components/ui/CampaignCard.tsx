import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useCallback, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { sanitizeImageUrl } from '@/core/api';
import { useLocale } from '@/core/i18n';
import {
  formatCampaignDate,
  formatPercent,
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
  TabularNumberStyle,
  TouchTarget,
  Typography,
} from '@/core/theme';
import { StatusBadge } from './StatusBadge';
import type { StatusBadgeTone } from './StatusBadge';

export interface CampaignCardProps {
  shopName: string;
  productName: string;
  imageUrl?: string | null;
  originalPriceSyp?: number | null;
  finalPriceSyp?: number | null;
  discountPercent: number;
  commissionAmountSyp?: number | null;
  commissionPercent?: number | null;
  endsAt: string;
  statusLabel: string;
  statusTone?: StatusBadgeTone;
  onPress: () => void;
  disabled?: boolean;
  index?: number;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

function getShopMonogram(shopName: string): string {
  const trimmed = shopName.trim();
  if (!trimmed) {
    return 'م';
  }
  return Array.from(trimmed)[0] ?? 'م';
}

export function CampaignCard({
  shopName,
  productName,
  imageUrl,
  originalPriceSyp,
  finalPriceSyp,
  discountPercent,
  commissionAmountSyp,
  commissionPercent,
  endsAt,
  statusLabel,
  statusTone = 'success',
  onPress,
  disabled = false,
  index = 0,
  testID,
  style,
}: CampaignCardProps) {
  const { locale, t } = useLocale();
  const { width: windowWidth } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const [metricsPanelWidth, setMetricsPanelWidth] = useState<number | null>(null);
  const pressProgress = useSharedValue(0);

  const safeImageUrl = sanitizeImageUrl(imageUrl);
  const showFallback = !safeImageUrl || failedImageUrl === safeImageUrl;
  const directionalText = getDirectionalTextStyle(locale);
  const isStackedMetrics =
    metricsPanelWidth !== null ? metricsPanelWidth < 264 : windowWidth < 360;
  const showOriginalPrice =
    originalPriceSyp !== null &&
    originalPriceSyp !== undefined &&
    finalPriceSyp !== null &&
    finalPriceSyp !== undefined &&
    originalPriceSyp > finalPriceSyp;

  const priceDisplay =
    finalPriceSyp !== null && finalPriceSyp !== undefined
      ? formatSyp(finalPriceSyp, locale)
      : formatPercent(discountPercent, locale);

  const priceHeading =
    finalPriceSyp !== null && finalPriceSyp !== undefined
      ? t.campaigns.finalPrice
      : t.campaigns.discountLabel;

  const commissionDisplay =
    commissionAmountSyp !== null && commissionAmountSyp !== undefined
      ? formatSyp(commissionAmountSyp, locale)
      : commissionPercent !== null && commissionPercent !== undefined
        ? formatPercent(commissionPercent, locale)
        : t.common.notAvailable;

  const formattedExpiry = formatCampaignDate(endsAt, locale);

  const handlePressIn = useCallback(() => {
    if (disabled) {
      return;
    }
    pressProgress.set(reducedMotion ? 1 : withTiming(1, { duration: 100 }));
  }, [disabled, pressProgress, reducedMotion]);

  const handlePressOut = useCallback(() => {
    pressProgress.set(reducedMotion ? 0 : withTiming(0, { duration: 140 }));
  }, [pressProgress, reducedMotion]);

  const handlePress = useCallback(() => {
    if (disabled) {
      return;
    }
    void Haptics.selectionAsync().catch(() => undefined);
    onPress();
  }, [disabled, onPress]);

  const handleImageError = useCallback(() => {
    if (safeImageUrl) {
      setFailedImageUrl(safeImageUrl);
    }
  }, [safeImageUrl]);

  const handleMetricsPanelLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    setMetricsPanelWidth((prev) => (prev === nextWidth ? prev : nextWidth));
  }, []);

  const animatedCardStyle = useAnimatedStyle(() => {
    const scale = reducedMotion ? 1 : 1 - pressProgress.value * 0.015;
    return {
      transform: [{ scale }],
    };
  });

  const enteringAnimation =
    reducedMotion || index > 6
      ? undefined
      : FadeInDown.delay(index * 45).duration(220);

  return (
    <Animated.View entering={enteringAnimation} style={style}>
      <Pressable
        testID={testID}
        disabled={disabled}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={`${productName} - ${shopName} - ${priceDisplay}`}
        accessibilityState={{ disabled }}
        style={styles.pressableContainer}
      >
        <Animated.View style={[styles.card, animatedCardStyle]}>
          <View style={styles.mediaFrame}>
            {showFallback ? (
              <View style={styles.storeFallback} accessible={false}>
                <View style={styles.monogramBadge}>
                  <Text style={styles.monogramText}>{getShopMonogram(shopName)}</Text>
                </View>
                <Text style={[Typography.label, directionalText, styles.fallbackShopText]}>
                  {shopName}
                </Text>
              </View>
            ) : (
              <Image
                source={{ uri: safeImageUrl }}
                style={styles.image}
                contentFit="cover"
                transition={reducedMotion ? 0 : 180}
                onError={handleImageError}
                accessibilityIgnoresInvertColors
              />
            )}
          </View>

          <View style={styles.metaHeader}>
            <Text style={[Typography.label, directionalText, styles.shopName]}>
              {shopName}
            </Text>
            <StatusBadge label={statusLabel} tone={statusTone} showDot />
          </View>

          <Text style={[Typography.section, directionalText, styles.productTitle]}>
            {productName}
          </Text>

          <View
            onLayout={handleMetricsPanelLayout}
            style={[
              styles.metricsPanel,
              isStackedMetrics ? styles.metricsPanelStacked : null,
            ]}
          >
            <View
              style={[
                styles.metricBlock,
                isStackedMetrics ? styles.metricBlockStacked : null,
              ]}
            >
              <Text style={[Typography.caption, directionalText]}>{priceHeading}</Text>
              <View style={styles.priceRow}>
                <Text style={[styles.priceValue, TabularNumberStyle, directionalText]}>
                  {priceDisplay}
                </Text>
                {showOriginalPrice ? (
                  <Text
                    style={[
                      Typography.caption,
                      TabularNumberStyle,
                      directionalText,
                      styles.originalPrice,
                    ]}
                  >
                    {formatSyp(originalPriceSyp, locale)}
                  </Text>
                ) : null}
              </View>
            </View>

            <View
              style={[
                styles.metricDivider,
                isStackedMetrics
                  ? styles.metricDividerHorizontal
                  : styles.metricDividerVertical,
              ]}
            />

            <View
              style={[
                styles.metricBlock,
                isStackedMetrics ? styles.metricBlockStacked : null,
              ]}
            >
              <Text style={[Typography.caption, directionalText]}>
                {t.campaigns.commission}
              </Text>
              <Text
                style={[styles.commissionValue, TabularNumberStyle, directionalText]}
              >
                {commissionDisplay}
              </Text>
            </View>
          </View>

          <View style={styles.footerRow}>
            <Text
              style={[
                Typography.caption,
                TabularNumberStyle,
                directionalText,
                styles.expiryText,
              ]}
            >
              {`${t.campaigns.endsAt}: ${formattedExpiry}`}
            </Text>
            <Text
              accessible={false}
              style={[styles.chevron, getMirrorTransform(locale)]}
            >
              {'›'}
            </Text>
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pressableContainer: {
    minWidth: TouchTarget.minWidth,
    minHeight: TouchTarget.minHeight,
    borderRadius: Radii.panel,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.gutter,
    gap: Spacing.compact + 4,
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
    width: 48,
    height: 48,
    borderRadius: Radii.panel,
    backgroundColor: Colors.surface,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramText: {
    fontFamily: FontFamily.bold,
    fontSize: 20,
    lineHeight: 28,
    color: Colors.dustyMauve,
  },
  fallbackShopText: {
    color: Colors.ink,
    textAlign: 'center',
  },
  metaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.compact,
  },
  shopName: {
    color: Colors.muted,
    flexGrow: 1,
    flexShrink: 1,
  },
  productTitle: {
    color: Colors.ink,
  },
  metricsPanel: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: Colors.canvas,
    borderRadius: Radii.control,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.compact + 4,
    gap: Spacing.compact + 4,
  },
  metricsPanelStacked: {
    flexDirection: 'column',
  },
  metricBlock: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.xs,
  },
  metricBlockStacked: {
    flex: 0,
    width: '100%',
  },
  metricDivider: {
    backgroundColor: Colors.rule,
  },
  metricDividerVertical: {
    width: BorderWidth.hairline,
    alignSelf: 'stretch',
  },
  metricDividerHorizontal: {
    height: BorderWidth.hairline,
    width: '100%',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: Spacing.compact,
  },
  priceValue: {
    fontFamily: FontFamily.bold,
    fontSize: 17,
    lineHeight: 24,
    color: Colors.ink,
  },
  originalPrice: {
    textDecorationLine: 'line-through',
    color: Colors.muted,
  },
  commissionValue: {
    fontFamily: FontFamily.bold,
    fontSize: 17,
    lineHeight: 24,
    color: Colors.action,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.compact,
    paddingTop: Spacing.xs,
    borderTopWidth: BorderWidth.hairline,
    borderTopColor: Colors.rule,
  },
  expiryText: {
    flex: 1,
    flexShrink: 1,
  },
  chevron: {
    fontFamily: FontFamily.bold,
    fontSize: 20,
    lineHeight: 24,
    color: Colors.muted,
  },
});
