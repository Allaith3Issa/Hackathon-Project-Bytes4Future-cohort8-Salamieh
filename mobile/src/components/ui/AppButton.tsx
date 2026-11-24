import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useLocale } from '@/core/i18n';
import { getDirectionalTextStyle } from '@/core/rtl';
import {
  BorderWidth,
  Colors,
  Radii,
  Spacing,
  TouchTarget,
  Typography,
} from '@/core/theme';

export type AppButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type AppButtonHaptic = 'light' | 'medium' | 'none';

export interface AppButtonProps {
  label: string;
  onPress: () => void;
  variant?: AppButtonVariant;
  loading?: boolean;
  loadingLabel?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  haptic?: AppButtonHaptic;
  startSlot?: ReactNode;
  endSlot?: ReactNode;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

const VARIANT_COLORS: Record<
  AppButtonVariant,
  {
    idleBg: string;
    pressedBg: string;
    textColor: string;
    borderColor: string;
    borderWidth: number;
  }
> = {
  primary: {
    idleBg: Colors.action,
    pressedBg: Colors.actionPressed,
    textColor: Colors.onInk,
    borderColor: Colors.action,
    borderWidth: 0,
  },
  secondary: {
    idleBg: Colors.surface,
    pressedBg: Colors.mauveTint,
    textColor: Colors.ink,
    borderColor: Colors.controlBorder,
    borderWidth: BorderWidth.hairline,
  },
  ghost: {
    idleBg: 'rgba(243, 230, 232, 0)',
    pressedBg: Colors.mauveTint,
    textColor: Colors.action,
    borderColor: 'transparent',
    borderWidth: 0,
  },
  danger: {
    idleBg: Colors.danger,
    pressedBg: '#7A2230',
    textColor: Colors.onInk,
    borderColor: Colors.danger,
    borderWidth: 0,
  },
};

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  loadingLabel,
  disabled = false,
  fullWidth = true,
  haptic = 'light',
  startSlot,
  endSlot,
  accessibilityLabel,
  accessibilityHint,
  testID,
  style,
}: AppButtonProps) {
  const { locale } = useLocale();
  const reducedMotion = useReducedMotion();
  const pressProgress = useSharedValue(0);

  const isDisabled = disabled || loading;
  const palette = VARIANT_COLORS[variant];
  const displayLabel = loading ? (loadingLabel ?? label) : label;

  const handlePressIn = useCallback(() => {
    if (isDisabled) {
      return;
    }
    pressProgress.set(reducedMotion ? 1 : withTiming(1, { duration: 100 }));
  }, [isDisabled, pressProgress, reducedMotion]);

  const handlePressOut = useCallback(() => {
    pressProgress.set(reducedMotion ? 0 : withTiming(0, { duration: 140 }));
  }, [pressProgress, reducedMotion]);

  const handlePress = useCallback(() => {
    if (isDisabled) {
      return;
    }

    if (haptic === 'medium') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    } else if (haptic === 'light') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }

    onPress();
  }, [haptic, isDisabled, onPress]);

  const animatedContainerStyle = useAnimatedStyle(() => {
    const scale = reducedMotion ? 1 : 1 - pressProgress.value * 0.024;
    return {
      transform: [{ scale }],
      backgroundColor: interpolateColor(
        pressProgress.value,
        [0, 1],
        [palette.idleBg, palette.pressedBg],
      ),
    };
  });

  return (
    <Pressable
      testID={testID}
      disabled={isDisabled}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? displayLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        styles.pressableBase,
        fullWidth ? styles.fullWidth : styles.inlineWidth,
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.surface,
          {
            borderColor: palette.borderColor,
            borderWidth: palette.borderWidth,
            opacity: isDisabled ? 0.58 : 1,
          },
          animatedContainerStyle,
        ]}
      >
        <View style={styles.contentRow}>
          {loading ? (
            <ActivityIndicator
              size="small"
              color={palette.textColor}
              style={styles.spinner}
            />
          ) : (
            startSlot
          )}

          <Text
            style={[
              Typography.action,
              getDirectionalTextStyle(locale),
              styles.label,
              { color: palette.textColor },
            ]}
          >
            {displayLabel}
          </Text>

          {!loading ? endSlot : null}
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressableBase: {
    minWidth: TouchTarget.minWidth,
    minHeight: TouchTarget.minHeight,
    borderRadius: Radii.control,
  },
  fullWidth: {
    width: '100%',
  },
  inlineWidth: {
    alignSelf: 'flex-start',
  },
  surface: {
    minWidth: TouchTarget.minWidth,
    minHeight: TouchTarget.minHeight,
    borderRadius: Radii.control,
    paddingHorizontal: Spacing.gutter,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.compact,
  },
  spinner: {
    flexShrink: 0,
  },
  label: {
    textAlign: 'center',
    flexShrink: 1,
  },
});
