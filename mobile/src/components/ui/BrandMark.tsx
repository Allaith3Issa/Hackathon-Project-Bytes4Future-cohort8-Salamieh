import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { useLocale } from '@/core/i18n';
import { Colors, Radii, Spacing } from '@/core/theme';

const BRAND_MARK_SOURCE = require('../../../assets/images/brand-mark.png');

export type BrandMarkSize = 'sm' | 'md' | 'lg' | 'xl';

export interface BrandMarkProps {
  size?: BrandMarkSize | number;
  framed?: boolean;
  decorative?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

const SIZE_MAP: Record<BrandMarkSize, number> = {
  sm: 28,
  md: 40,
  lg: 52,
  xl: 68,
};

function resolveDimension(size: BrandMarkSize | number): number {
  if (typeof size === 'number') {
    return Math.max(20, Math.round(size));
  }
  return SIZE_MAP[size];
}

export function BrandMark({
  size = 'lg',
  framed = false,
  decorative = false,
  accessibilityLabel,
  testID,
  style,
}: BrandMarkProps) {
  const { t } = useLocale();
  const dimension = resolveDimension(size);
  const resolvedLabel = accessibilityLabel ?? t.common.appName;

  return (
    <View
      testID={testID}
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'image'}
      accessibilityLabel={decorative ? undefined : resolvedLabel}
      style={[
        styles.container,
        {
          width: dimension,
          height: dimension,
        },
        framed ? styles.framed : null,
        style,
      ]}
    >
      <Image
        source={BRAND_MARK_SOURCE}
        style={styles.image}
        contentFit="contain"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  framed: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.panel,
    padding: Spacing.xs,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
