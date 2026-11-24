import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { useLocale } from '@/core/i18n';
import { getDirectionalTextStyle, LtrTextStyle } from '@/core/rtl';
import { BorderWidth, Colors, FontFamily, Radii, Spacing } from '@/core/theme';

export type StatusBadgeTone =
  | 'success'
  | 'warning'
  | 'info'
  | 'danger'
  | 'mauve'
  | 'action'
  | 'neutral';

export interface StatusBadgeProps {
  label: string;
  tone?: StatusBadgeTone;
  showDot?: boolean;
  forceLtr?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const TONE_PALETTE: Record<
  StatusBadgeTone,
  { backgroundColor: string; textColor: string; borderColor: string }
> = {
  success: {
    backgroundColor: Colors.successBg,
    textColor: Colors.success,
    borderColor: 'rgba(49, 93, 71, 0.22)',
  },
  warning: {
    backgroundColor: Colors.warningBg,
    textColor: Colors.warning,
    borderColor: 'rgba(120, 69, 26, 0.22)',
  },
  info: {
    backgroundColor: Colors.infoBg,
    textColor: Colors.info,
    borderColor: 'rgba(83, 71, 103, 0.22)',
  },
  danger: {
    backgroundColor: Colors.dangerBg,
    textColor: Colors.danger,
    borderColor: 'rgba(152, 45, 61, 0.22)',
  },
  mauve: {
    backgroundColor: Colors.mauveTint,
    textColor: Colors.ink,
    borderColor: Colors.rule,
  },
  action: {
    backgroundColor: Colors.mauveTint,
    textColor: Colors.action,
    borderColor: 'rgba(181, 71, 24, 0.22)',
  },
  neutral: {
    backgroundColor: Colors.canvas,
    textColor: Colors.muted,
    borderColor: Colors.rule,
  },
};

export function StatusBadge({
  label,
  tone = 'neutral',
  showDot = false,
  forceLtr = false,
  accessibilityLabel,
  style,
}: StatusBadgeProps) {
  const { locale } = useLocale();
  const palette = TONE_PALETTE[tone];

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? label}
      style={[
        styles.badge,
        {
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor,
        },
        style,
      ]}
    >
      {showDot ? (
        <View style={[styles.dot, { backgroundColor: palette.textColor }]} />
      ) : null}
      <Text
        style={[
          styles.label,
          forceLtr ? LtrTextStyle : getDirectionalTextStyle(locale),
          { color: palette.textColor },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: Radii.control,
    borderWidth: BorderWidth.hairline,
    paddingHorizontal: Spacing.compact + 2,
    paddingVertical: Spacing.xs,
    gap: Spacing.xs + 2,
    maxWidth: '100%',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    flexShrink: 0,
  },
  label: {
    fontFamily: FontFamily.semiBold,
    fontSize: 13,
    lineHeight: 19,
    flexShrink: 1,
  },
});
