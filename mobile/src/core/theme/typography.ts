import type { TextStyle } from 'react-native';

import { Colors } from './colors';

/**
 * Loaded native font asset keys registered via expo-font in _layout.tsx.
 * Each weight maps directly to its dedicated IBM Plex Sans Arabic TTF file
 * so Android does not synthesize or fall back to system fonts.
 */
export const FontFamily = {
  regular: 'IBMPlexSansArabic-Regular',
  semiBold: 'IBMPlexSansArabic-SemiBold',
  bold: 'IBMPlexSansArabic-Bold',
} as const;

export const FontAssets = {
  [FontFamily.regular]: require('../../../assets/fonts/IBMPlexSansArabic-Regular.ttf'),
  [FontFamily.semiBold]: require('../../../assets/fonts/IBMPlexSansArabic-SemiBold.ttf'),
  [FontFamily.bold]: require('../../../assets/fonts/IBMPlexSansArabic-Bold.ttf'),
} as const;

export type TypographyVariant =
  | 'display'
  | 'section'
  | 'body'
  | 'label'
  | 'action'
  | 'balance'
  | 'caption';

/**
 * Android typography starting points matching design.md.
 * System font scaling remains enabled (allowFontScaling is never disabled).
 */
export const Typography: Record<TypographyVariant, TextStyle> = {
  display: {
    fontFamily: FontFamily.bold,
    fontSize: 28,
    lineHeight: 38,
    color: Colors.ink,
  },
  section: {
    fontFamily: FontFamily.bold,
    fontSize: 20,
    lineHeight: 28,
    color: Colors.ink,
  },
  body: {
    fontFamily: FontFamily.regular,
    fontSize: 16,
    lineHeight: 26,
    color: Colors.ink,
  },
  label: {
    fontFamily: FontFamily.semiBold,
    fontSize: 14,
    lineHeight: 22,
    color: Colors.ink,
  },
  action: {
    fontFamily: FontFamily.semiBold,
    fontSize: 16,
    lineHeight: 24,
    color: Colors.onInk,
  },
  balance: {
    fontFamily: FontFamily.bold,
    fontSize: 32,
    lineHeight: 42,
    color: Colors.onInk,
    fontVariant: ['tabular-nums'],
  },
  caption: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    lineHeight: 20,
    color: Colors.muted,
  },
} as const;

export const TabularNumberStyle: TextStyle = {
  fontVariant: ['tabular-nums'],
};
