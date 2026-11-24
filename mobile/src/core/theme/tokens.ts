/**
 * Layout spacing, border radii, and Android touch-target constants
 * matching design.md.
 */
export const Spacing = {
  xs: 4,
  compact: 8,
  gutter: 16,
  section: 24,
  xl: 32,
} as const;

export const Radii = {
  control: 8,
  panel: 12,
} as const;

export const TouchTarget = {
  minWidth: 48,
  minHeight: 48,
} as const;

export const BorderWidth = {
  hairline: 1,
  focus: 1.5,
} as const;
