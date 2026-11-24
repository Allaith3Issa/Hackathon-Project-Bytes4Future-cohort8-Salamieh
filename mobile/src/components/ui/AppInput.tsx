import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { ComponentRef, ReactNode, Ref } from 'react';
import type { StyleProp, TextInputProps, TextStyle, ViewStyle } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useLocale } from '@/core/i18n';
import { getDirectionalTextStyle, LtrTextStyle } from '@/core/rtl';
import {
  BorderWidth,
  Colors,
  Radii,
  Spacing,
  TouchTarget,
  Typography,
} from '@/core/theme';

export interface AppInputProps extends Omit<TextInputProps, 'style' | 'ref'> {
  label?: string;
  error?: string | null;
  hint?: string;
  forceLtr?: boolean;
  endAccessory?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  ref?: Ref<ComponentRef<typeof TextInput>>;
}

export function AppInput({
  label,
  error,
  hint,
  forceLtr = false,
  endAccessory,
  containerStyle,
  inputStyle,
  onFocus,
  onBlur,
  editable = true,
  ref,
  ...textInputProps
}: AppInputProps) {
  const { locale } = useLocale();
  const reducedMotion = useReducedMotion();
  const [isFocused, setIsFocused] = useState(false);

  const hasError = Boolean(error && error.trim().length > 0);
  // Border state: 0 = idle, 1 = focused, 2 = error
  const targetState = hasError ? 2 : isFocused ? 1 : 0;
  const borderProgress = useSharedValue(targetState);

  useEffect(() => {
    borderProgress.value = reducedMotion
      ? targetState
      : withTiming(targetState, { duration: 150 });
  }, [borderProgress, reducedMotion, targetState]);

  const animatedWrapperStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      borderProgress.value,
      [0, 1, 2],
      [Colors.controlBorder, Colors.action, Colors.danger],
    ),
    borderWidth: borderProgress.value > 0.5 ? BorderWidth.focus : BorderWidth.hairline,
  }));

  const handleFocus = useCallback(
    (event: Parameters<NonNullable<TextInputProps['onFocus']>>[0]) => {
      setIsFocused(true);
      onFocus?.(event);
    },
    [onFocus],
  );

  const handleBlur = useCallback(
    (event: Parameters<NonNullable<TextInputProps['onBlur']>>[0]) => {
      setIsFocused(false);
      onBlur?.(event);
    },
    [onBlur],
  );

  const directionalText = getDirectionalTextStyle(locale);

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text style={[Typography.label, directionalText, styles.label]}>{label}</Text>
      ) : null}

      <Animated.View
        style={[
          styles.inputWrapper,
          !editable ? styles.inputDisabled : null,
          animatedWrapperStyle,
        ]}
      >
        <TextInput
          ref={ref}
          editable={editable}
          placeholderTextColor={Colors.muted}
          selectionColor={Colors.action}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={[
            Typography.body,
            styles.input,
            forceLtr ? LtrTextStyle : directionalText,
            endAccessory ? styles.inputWithAccessory : styles.inputStandardEnd,
            inputStyle,
          ]}
          {...textInputProps}
          accessibilityLabel={textInputProps.accessibilityLabel ?? label}
          accessibilityHint={
            textInputProps.accessibilityHint ??
            (hasError ? error ?? undefined : hint)
          }
          accessibilityState={{
            ...textInputProps.accessibilityState,
            disabled: !editable,
          }}
        />
        {endAccessory ? <View style={styles.endAccessory}>{endAccessory}</View> : null}
      </Animated.View>

      {hasError ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[Typography.caption, directionalText, styles.errorText]}
        >
          {error}
        </Text>
      ) : hint ? (
        <Text style={[Typography.caption, directionalText, styles.hintText]}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    marginBottom: Spacing.compact,
  },
  inputWrapper: {
    minHeight: TouchTarget.minHeight,
    borderRadius: Radii.control,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputDisabled: {
    backgroundColor: Colors.mauveTint,
    opacity: 0.78,
  },
  input: {
    flex: 1,
    minHeight: TouchTarget.minHeight - 2,
    paddingStart: Spacing.gutter,
    paddingVertical: 10,
    color: Colors.ink,
  },
  inputStandardEnd: {
    paddingEnd: Spacing.gutter,
  },
  inputWithAccessory: {
    paddingEnd: Spacing.xs,
  },
  endAccessory: {
    minWidth: TouchTarget.minWidth,
    minHeight: TouchTarget.minHeight,
    justifyContent: 'center',
    alignItems: 'center',
    paddingEnd: Spacing.xs,
  },
  errorText: {
    marginTop: Spacing.xs + 2,
    color: Colors.danger,
  },
  hintText: {
    marginTop: Spacing.xs + 2,
    color: Colors.muted,
  },
});
