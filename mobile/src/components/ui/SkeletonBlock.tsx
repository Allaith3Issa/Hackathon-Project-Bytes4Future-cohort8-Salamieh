import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import type { DimensionValue, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { BorderWidth, Colors, Radii, Spacing } from '@/core/theme';

export type SkeletonTone = 'mauve' | 'surface' | 'ink';

export interface SkeletonBlockProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  tone?: SkeletonTone;
  style?: StyleProp<ViewStyle>;
}

const TONE_BACKGROUNDS: Record<SkeletonTone, string> = {
  mauve: Colors.mauveTint,
  surface: '#EAE0E3',
  ink: 'rgba(255, 255, 255, 0.20)',
};

export function SkeletonBlock({
  width = '100%',
  height = 16,
  borderRadius = Radii.control,
  tone = 'mauve',
  style,
}: SkeletonBlockProps) {
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(reducedMotion ? 0.72 : 0.48);

  useEffect(() => {
    if (reducedMotion) {
      cancelAnimation(opacity);
      opacity.value = 0.72;
      return;
    }

    opacity.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: 750,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(0.48, {
          duration: 750,
          easing: Easing.inOut(Easing.ease),
        }),
      ),
      -1,
      false,
    );

    return () => {
      cancelAnimation(opacity);
    };
  }, [opacity, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.block,
        {
          width,
          height,
          borderRadius,
          backgroundColor: TONE_BACKGROUNDS[tone],
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

/**
 * Geometry-matched skeleton mirroring CampaignCard proportions
 * to eliminate layout jumps while active campaigns load.
 */
export function CampaignCardSkeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.cardSkeleton, style]} accessible={false}>
      <SkeletonBlock height={172} borderRadius={Radii.panel} />

      <View style={styles.rowBetween}>
        <SkeletonBlock width="42%" height={18} />
        <SkeletonBlock width={72} height={24} />
      </View>

      <SkeletonBlock width="84%" height={24} />
      <SkeletonBlock width="58%" height={20} />

      <View style={styles.metricsSkeleton}>
        <View style={styles.metricColumn}>
          <SkeletonBlock width={64} height={14} />
          <SkeletonBlock width={96} height={20} />
        </View>
        <View style={styles.metricColumn}>
          <SkeletonBlock width={76} height={14} />
          <SkeletonBlock width={88} height={20} />
        </View>
      </View>

      <View style={styles.rowBetween}>
        <SkeletonBlock width="48%" height={14} />
        <SkeletonBlock width={20} height={14} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    overflow: 'hidden',
  },
  cardSkeleton: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.panel,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
    padding: Spacing.gutter,
    gap: Spacing.compact + 4,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.compact,
  },
  metricsSkeleton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.compact,
    backgroundColor: Colors.canvas,
    borderRadius: Radii.control,
    padding: Spacing.compact + 4,
  },
  metricColumn: {
    gap: Spacing.xs + 2,
  },
});
