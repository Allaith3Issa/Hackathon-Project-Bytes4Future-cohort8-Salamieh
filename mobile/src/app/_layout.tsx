import { isRunningInExpoGo } from 'expo';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import type { Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BrandSplashOverlay } from '@/components/ui';
import {
  AuthProvider,
  hasCustomerRole,
  hasMarketerRole,
  hasMerchantRole,
  useAuth,
} from '@/core/auth';
import { LocaleProvider, useLocale } from '@/core/i18n';
import { getDirectionContainerStyle, getLayoutDirection } from '@/core/rtl';
import { Colors, FontAssets } from '@/core/theme';

export const unstable_settings = {
  anchor: 'index',
};

void SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore if splash screen was already hidden or unavailable on the current platform.
});

const IS_EXPO_GO = isRunningInExpoGo();
const EXPO_GO_MIN_SPLASH_MS = 450;
const NATIVE_SPLASH_FALLBACK_HIDE_MS = 1200;

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { locale, isRtl, isLocaleReady } = useLocale();
  const {
    status,
    user,
    activeRole,
    hydrationError,
    pendingReferralCode,
  } = useAuth();
  const reducedMotion = useReducedMotion();

  const nativeSplashHiddenRef = useRef(false);
  const [imageReady, setImageReady] = useState(false);
  const [minDelayElapsed, setMinDelayElapsed] = useState(!IS_EXPO_GO);
  const [overlayMounted, setOverlayMounted] = useState(true);

  const isHydratingWithoutError = status === 'hydrating' && hydrationError === null;
  const appReady =
    fontsReady && isLocaleReady && (status !== 'hydrating' || hydrationError !== null);
  const isAuthenticated = status === 'authenticated' && user !== null;
  const isCustomerWorkspace =
    isAuthenticated && activeRole === 'customer' && hasCustomerRole(user);
  const isMarketerWorkspace =
    isAuthenticated && activeRole === 'marketer' && hasMarketerRole(user);
  const isMerchantWorkspace =
    isAuthenticated && activeRole === 'merchant' && hasMerchantRole(user);
  const isSelectingWorkspace =
    isAuthenticated &&
    !isCustomerWorkspace &&
    !isMarketerWorkspace &&
    !isMerchantWorkspace;

  const effectiveMinDelayElapsed = !IS_EXPO_GO || Boolean(reducedMotion) || minDelayElapsed;
  const splashVisible = !appReady || !imageReady || !effectiveMinDelayElapsed;

  useEffect(() => {
    if (!IS_EXPO_GO || reducedMotion) {
      return;
    }

    const timer = setTimeout(() => {
      setMinDelayElapsed(true);
    }, EXPO_GO_MIN_SPLASH_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [reducedMotion]);

  const hideNativeSplash = useCallback(() => {
    if (nativeSplashHiddenRef.current) {
      return;
    }
    nativeSplashHiddenRef.current = true;
    void SplashScreen.hideAsync().catch(() => {
      // Safe no-op when native splash has already dismissed.
    });
  }, []);

  const handleSplashFirstRender = useCallback(() => {
    setImageReady(true);
    hideNativeSplash();
  }, [hideNativeSplash]);

  useEffect(() => {
    const fallbackHideTimer = setTimeout(() => {
      setImageReady(true);
      hideNativeSplash();
    }, NATIVE_SPLASH_FALLBACK_HIDE_MS);

    return () => {
      clearTimeout(fallbackHideTimer);
    };
  }, [hideNativeSplash]);

  const handleSplashHidden = useCallback(() => {
    setOverlayMounted(false);
  }, []);

  const rootContainerStyle = useMemo(
    () => [styles.root, getDirectionContainerStyle(locale)],
    [locale],
  );

  const rootStackScreenOptions = useMemo(
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

  const customerRedirectHref: Href = pendingReferralCode
    ? (`/customer?code=${encodeURIComponent(pendingReferralCode)}` as Href)
    : ('/customer' as Href);

  const authenticatedRedirect: Href = isCustomerWorkspace
    ? customerRedirectHref
    : isMarketerWorkspace
      ? ('/marketer' as Href)
      : isMerchantWorkspace
        ? ('/merchant' as Href)
        : ('/workspace-select' as Href);

  const workspaceExitRedirect: Href = isAuthenticated
    ? authenticatedRedirect
    : status === 'hydrating'
      ? ('/' as Href)
      : ('/(auth)/login' as Href);

  return (
    <View style={rootContainerStyle}>
      <Stack screenOptions={rootStackScreenOptions}>
        <Stack.Screen name="index" />
        <Stack.Screen name="r/[code]" />

        <Stack.Protected
          guard={isHydratingWithoutError || isCustomerWorkspace}
          redirectTo={workspaceExitRedirect}
        >
          <Stack.Screen name="customer" />
        </Stack.Protected>

        <Stack.Protected
          guard={isHydratingWithoutError || isMarketerWorkspace}
          redirectTo={workspaceExitRedirect}
        >
          <Stack.Screen name="marketer" />
        </Stack.Protected>

        <Stack.Protected
          guard={isHydratingWithoutError || isMerchantWorkspace}
          redirectTo={workspaceExitRedirect}
        >
          <Stack.Screen name="merchant" />
        </Stack.Protected>

        <Stack.Protected
          guard={isHydratingWithoutError || isSelectingWorkspace}
          redirectTo={workspaceExitRedirect}
        >
          <Stack.Screen name="workspace-select" />
        </Stack.Protected>

        <Stack.Protected
          guard={isHydratingWithoutError || !isAuthenticated}
          redirectTo={authenticatedRedirect}
        >
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>

      {overlayMounted ? (
        <BrandSplashOverlay
          visible={splashVisible}
          onFirstRender={handleSplashFirstRender}
          onHidden={handleSplashHidden}
        />
      ) : null}
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FontAssets);
  const fontsReady = fontsLoaded || Boolean(fontError);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <LocaleProvider>
          <AuthProvider>
            <RootNavigator fontsReady={fontsReady} />
          </AuthProvider>
        </LocaleProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
});
