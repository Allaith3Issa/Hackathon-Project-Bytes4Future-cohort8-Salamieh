/**
 * Shared color tokens matching ../Hacjathon file/docs/handoff/frontend/design.md 1:1.
 * Warm light palette tailored for "عروض السلمية / Alsalamiyah Offers".
 */
export const Colors = {
  action: '#B54718',
  actionPressed: '#943710',
  dustyMauve: '#B78391',
  mauveTint: '#F3E6E8',
  ink: '#503C44',
  onInk: '#FFFFFF',
  muted: '#6F555F',
  canvas: '#FBF7F2',
  surface: '#FFFFFF',
  rule: '#DDCBD0',
  controlBorder: '#987582',
  success: '#315D47',
  successBg: '#EDF5EF',
  danger: '#982D3D',
  dangerBg: '#FDF2F4',
  info: '#534767',
  infoBg: '#F1EDF5',
  warning: '#78451A',
  warningBg: '#FFF2DF',
} as const;

export type ColorToken = keyof typeof Colors;
