import { Stack } from 'expo-router';
import { useMemo } from 'react';

import { useLocale } from '@/core/i18n';
import { getLayoutDirection } from '@/core/rtl';
import { Colors } from '@/core/theme';

export const unstable_settings = {
  anchor: 'login',
};

export default function AuthGroupLayout() {
  const { locale, isRtl } = useLocale();

  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      contentStyle: {
        backgroundColor: Colors.canvas,
        direction: getLayoutDirection(locale),
      },
      animation: 'fade' as const,
    }),
    [locale],
  );

  const registerOptions = useMemo(
    () => ({
      animation: (isRtl ? 'slide_from_left' : 'slide_from_right') as
        | 'slide_from_left'
        | 'slide_from_right',
    }),
    [isRtl],
  );

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" options={registerOptions} />
    </Stack>
  );
}
