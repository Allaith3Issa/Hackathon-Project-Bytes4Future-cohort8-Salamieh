import { Stack } from 'expo-router';
import { useMemo } from 'react';

import { useLocale } from '@/core/i18n';
import { getLayoutDirection } from '@/core/rtl';
import { Colors } from '@/core/theme';

export default function CustomerGroupLayout() {
  const { locale, isRtl } = useLocale();

  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      contentStyle: {
        backgroundColor: Colors.canvas,
        direction: getLayoutDirection(locale),
      },
      animation: (isRtl ? 'slide_from_left' : 'slide_from_right') as
        | 'slide_from_left'
        | 'slide_from_right',
    }),
    [isRtl, locale],
  );

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
