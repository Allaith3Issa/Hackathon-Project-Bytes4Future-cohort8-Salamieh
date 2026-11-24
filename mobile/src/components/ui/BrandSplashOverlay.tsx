import { Image } from 'expo-image';
import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useLocale } from '@/core/i18n';
import { Colors, Spacing } from '@/core/theme';

const SPLASH_ICON_SOURCE = require('../../../assets/images/splash-icon.png');
const NATIVE_SPLASH_IMAGE_WIDTH = 280;
const FADE_OUT_DURATION_MS = 240;

export interface BrandSplashOverlayProps {
  visible: boolean;
  onFirstRender?: () => void;
  onHidden?: () => void;
  testID?: string;
}

export function BrandSplashOverlay({
  visible,
  onFirstRender,
  onHidden,
  testID = 'brand-splash-overlay',
}: BrandSplashOverlayProps) {
  const { t } = useLocale();
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  const didNotifyFirstRenderRef = useRef(false);

  useEffect(() => {
    if (visible) {
      opacity.set(1);
      return;
    }

    if (reducedMotion) {
      opacity.set(0);
    } else {
      opacity.set(withTiming(0, { duration: FADE_OUT_DURATION_MS }));
    }

    if (!onHidden) {
      return;
    }

    const delayMs = reducedMotion ? 0 : FADE_OUT_DURATION_MS + 16;
    const timer = setTimeout(() => {
      onHidden();
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [onHidden, opacity, reducedMotion, visible]);

  const handleImageReady = useCallback(() => {
    if (didNotifyFirstRenderRef.current) {
      return;
    }
    didNotifyFirstRenderRef.current = true;
    onFirstRender?.();
  }, [onFirstRender]);

  const animatedOverlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      testID={testID}
      pointerEvents={visible ? 'auto' : 'none'}
      accessible={visible}
      accessibilityRole="image"
      accessibilityLabel={visible ? t.common.appName : undefined}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'yes' : 'no-hide-descendants'}
      style={[styles.overlay, animatedOverlayStyle]}
    >
      <View style={styles.logoFrame}>
        <Image
          source={SPLASH_ICON_SOURCE}
          style={styles.logoImage}
          contentFit="contain"
          priority="high"
          transition={0}
          onLoad={handleImageReady}
          onError={handleImageReady}
          accessibilityIgnoresInvertColors
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    start: 0,
    end: 0,
    zIndex: 999,
    elevation: 999,
    backgroundColor: Colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.gutter,
  },
  logoFrame: {
    width: NATIVE_SPLASH_IMAGE_WIDTH,
    maxWidth: '85%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
});
