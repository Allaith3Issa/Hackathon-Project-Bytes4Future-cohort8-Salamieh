import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { BackHandler, Platform, ToastAndroid } from 'react-native';

import { useLocale } from '../i18n';
import { overlayStack } from './overlayStack';

const EXIT_CONFIRM_WINDOW_MS = 2_000;
let lastRootBackPressAt = 0;

export interface UseAndroidBackOptions {
  /** Enable or disable this back handler (e.g. tied to navigation focus). */
  enabled?: boolean;
  /** Block accidental hardware back during critical in-flight mutations (e.g. join/payout). */
  isBusy?: boolean;
  /** Treat the current screen as a root tab destination requiring double-back exit confirmation. */
  isRootTab?: boolean;
  /** Optional custom handler returning true if it consumed the back press. */
  onBack?: () => boolean;
}

/**
 * Unified Android hardware Back & gesture handler:
 * 1. Guard critical in-flight mutations before touching overlays or routes.
 * 2. Dismiss topmost registered overlay/modal/bottom sheet.
 * 3. Execute custom screen back handler if provided.
 * 4. Pop Expo Router stack when possible.
 * 5. Require deliberate double-press exit confirmation on root screens via BackHandler.exitApp().
 */
export function useAndroidBack(options: UseAndroidBackOptions = {}): void {
  const { enabled = true, isBusy = false, isRootTab = false, onBack } = options;
  const router = useRouter();
  const { t } = useLocale();

  const onBackRef = useRef(onBack);
  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  useEffect(() => {
    if (Platform.OS !== 'android' || !enabled) {
      return undefined;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isBusy) {
        return true;
      }

      if (overlayStack.dismissTop()) {
        return true;
      }

      if (onBackRef.current?.()) {
        return true;
      }

      if (!isRootTab && router.canGoBack()) {
        router.back();
        return true;
      }

      if (isRootTab) {
        const now = Date.now();
        if (now - lastRootBackPressAt < EXIT_CONFIRM_WINDOW_MS) {
          lastRootBackPressAt = 0;
          BackHandler.exitApp();
          return true;
        }
        lastRootBackPressAt = now;
        ToastAndroid.show(t.common.pressBackAgainToExit, ToastAndroid.SHORT);
        return true;
      }

      return false;
    });

    return () => {
      subscription.remove();
    };
  }, [enabled, isBusy, isRootTab, router, t.common.pressBackAgainToExit]);
}

export function useOverlayBackRegistration(
  id: string,
  isOpen: boolean,
  onDismiss: () => boolean | void,
): void {
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!isOpen) {
      overlayStack.remove(id);
      return;
    }

    overlayStack.push({
      id,
      onDismiss: () => onDismissRef.current(),
    });

    return () => {
      overlayStack.remove(id);
    };
  }, [id, isOpen]);
}
