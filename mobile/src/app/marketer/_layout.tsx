import { Stack } from 'expo-router';
import { useMemo } from 'react';

import { useLocale } from '@/core/i18n';
import { getLayoutDirection } from '@/core/rtl';
import { Colors } from '@/core/theme';

export default function MarketerGroupLayout() {
  const { locale, isRtl } = useLocale();

  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      contentStyle: {
        backgroundColor: Colors.canvas,
        direction: getLayoutDirection(locale),
      },
    }),
    [locale],
  );

  const campaignDetailOptions = useMemo(
    () => ({
      animation: (isRtl ? 'slide_from_left' : 'slide_from_right') as
        | 'slide_from_left'
        | 'slide_from_right',
    }),
    [isRtl],
  );

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="campaigns/[id]" options={campaignDetailOptions} />
    </Stack>
  );
}
