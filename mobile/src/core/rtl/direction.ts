import { I18nManager } from 'react-native';
import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';

import type { AppLocale } from '../i18n/types';

const LRI = '\u2066';
const PDI = '\u2069';

export function isLocaleRtl(locale: AppLocale): boolean {
  return locale === 'ar';
}

export function getLayoutDirection(locale: AppLocale): 'rtl' | 'ltr' {
  return isLocaleRtl(locale) ? 'rtl' : 'ltr';
}

/**
 * Synchronize React Native's native I18nManager RTL flag with the active locale.
 * We intentionally do NOT trigger a forced native reload here so in-app live AR/EN
 * toggles preserve navigation and form state while Yoga's reactive `direction`
 * container and Stack/Tab layouts re-align immediately.
 */
export function syncNativeDirection(locale: AppLocale): boolean {
  const shouldBeRtl = isLocaleRtl(locale);
  I18nManager.allowRTL(true);
  if (I18nManager.isRTL !== shouldBeRtl) {
    I18nManager.forceRTL(shouldBeRtl);
    return true;
  }
  return false;
}

/**
 * Reactive Yoga direction style applied at the root container so switching
 * Arabic (RTL) <-> English (LTR) in Profile -> Settings takes effect immediately.
 */
export function getDirectionContainerStyle(locale: AppLocale): ViewStyle {
  return {
    direction: getLayoutDirection(locale),
  };
}

/**
 * Direction-aware text alignment & writingDirection for multi-line labels/copy.
 */
export function getDirectionalTextStyle(locale: AppLocale): TextStyle {
  const rtl = isLocaleRtl(locale);
  return {
    writingDirection: rtl ? 'rtl' : 'ltr',
    textAlign: rtl ? 'right' : 'left',
  };
}

/**
 * Forced LTR text style for Syrian phone numbers (^09[0-9]{8}$),
 * pass/referral codes (OF-...), and raw referralUrl strings inside RTL layouts.
 */
export const LtrTextStyle: TextStyle = {
  writingDirection: 'ltr',
  textAlign: 'left',
};

/**
 * Wrap embedded LTR tokens (phones, codes, URLs) with Unicode First-Strong Isolates
 * when interpolated inside Arabic RTL sentences.
 */
export function isolateLtr(value: string): string {
  return `${LRI}${value}${PDI}`;
}

/**
 * Mirror directional icons (back/forward chevrons) cleanly when RTL is active.
 */
export function getMirrorTransform(locale: AppLocale): ImageStyle & ViewStyle {
  return {
    transform: [{ scaleX: isLocaleRtl(locale) ? -1 : 1 }],
  };
}
