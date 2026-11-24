import { StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { useLocale } from '@/core/i18n';
import { formatSyp, getDirectionalTextStyle } from '@/core/rtl';
import {
  BorderWidth,
  Colors,
  Radii,
  Spacing,
  TabularNumberStyle,
  Typography,
} from '@/core/theme';
import { SkeletonBlock } from './SkeletonBlock';
import { StatusBadge } from './StatusBadge';
import type { StatusBadgeTone } from './StatusBadge';

export type BalanceCardVariant = 'primary' | 'secondary';

export interface BalanceCardProps {
  label: string;
  amountSyp: number;
  hint?: string;
  variant?: BalanceCardVariant;
  loading?: boolean;
  badge?: {
    label: string;
    tone?: StatusBadgeTone;
  };
  action?: ReactNode;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function BalanceCard({
  label,
  amountSyp,
  hint,
  variant = 'primary',
  loading = false,
  badge,
  action,
  accessibilityLabel,
  testID,
  style,
}: BalanceCardProps) {
  const { locale } = useLocale();
  const reducedMotion = useReducedMotion();

  const isPrimary = variant === 'primary';
  const formattedAmount = formatSyp(amountSyp, locale);
  const directionalText = getDirectionalTextStyle(locale);
  const summaryAccessibilityLabel = loading
    ? label
    : (accessibilityLabel ?? `${label}: ${formattedAmount}`);

  return (
    <Animated.View
      testID={testID}
      entering={reducedMotion ? undefined : FadeIn.duration(220)}
      style={[
        styles.card,
        isPrimary ? styles.primaryCard : styles.secondaryCard,
        style,
      ]}
    >
      <View
        accessible
        accessibilityRole="summary"
        accessibilityLabel={summaryAccessibilityLabel}
        style={styles.summaryContent}
      >
        <View style={styles.headerRow}>
          <Text
            style={[
              Typography.label,
              directionalText,
              styles.labelText,
              isPrimary ? styles.primaryMutedText : styles.secondaryMutedText,
            ]}
          >
            {label}
          </Text>
          {badge ? <StatusBadge label={badge.label} tone={badge.tone ?? 'mauve'} /> : null}
        </View>

        <View style={styles.amountContainer}>
          {loading ? (
            <SkeletonBlock
              width="62%"
              height={38}
              borderRadius={Radii.control}
              tone={isPrimary ? 'ink' : 'surface'}
            />
          ) : (
            <Text
              style={[
                Typography.balance,
                TabularNumberStyle,
                directionalText,
                isPrimary ? styles.primaryAmountText : styles.secondaryAmountText,
              ]}
            >
              {formattedAmount}
            </Text>
          )}
        </View>

        {hint ? (
          <Text
            style={[
              Typography.caption,
              directionalText,
              isPrimary ? styles.primaryHintText : styles.secondaryHintText,
            ]}
          >
            {hint}
          </Text>
        ) : null}
      </View>

      {action ? <View style={styles.actionSlot}>{action}</View> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.panel,
    padding: Spacing.section,
    gap: Spacing.compact,
  },
  summaryContent: {
    gap: Spacing.compact,
  },
  primaryCard: {
    backgroundColor: Colors.ink,
  },
  secondaryCard: {
    backgroundColor: Colors.mauveTint,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.rule,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.compact,
  },
  labelText: {
    flexShrink: 1,
  },
  primaryMutedText: {
    color: Colors.mauveTint,
  },
  secondaryMutedText: {
    color: Colors.muted,
  },
  amountContainer: {
    minHeight: 42,
    justifyContent: 'center',
    paddingVertical: Spacing.xs,
  },
  primaryAmountText: {
    color: Colors.onInk,
  },
  secondaryAmountText: {
    color: Colors.ink,
  },
  primaryHintText: {
    color: 'rgba(255, 255, 255, 0.80)',
  },
  secondaryHintText: {
    color: Colors.muted,
  },
  actionSlot: {
    marginTop: Spacing.compact,
  },
});
