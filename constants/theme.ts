/**
 * FitSense Design Tokens
 * Single source of truth for colors, spacing, radius, shadows, and typography.
 */

import { Platform } from 'react-native';

// ─── Colors ───────────────────────────────────────────────────────────────────

export const Colors = {
  // Brand
  accent: '#E8620A',
  accentDim: 'rgba(232,98,10,0.18)',

  // Backgrounds
  bg: '#080808',
  surface: '#111111',
  surface2: '#161616',
  surface3: '#1E1E1E',
  surface4: '#2A2A2A',

  // Text
  text: '#F2F2F2',
  textSub: 'rgba(242,242,242,0.55)',
  textMuted: 'rgba(242,242,242,0.35)',

  // Borders
  border: 'rgba(255,255,255,0.07)',
  border2: 'rgba(255,255,255,0.12)',

  // Semantic
  danger: '#FF4D4D',
  success: '#34C759',
  warning: '#FF9F0A',

  // Legacy Expo router compatibility (kept so any file importing Colors.light / Colors.dark still works)
  light: {
    text: '#11181C',
    background: '#fff',
    tint: '#0a7ea4',
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: '#0a7ea4',
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: '#fff',
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#fff',
  },
};

// ─── Spacing ──────────────────────────────────────────────────────────────────

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

// ─── Border Radius ────────────────────────────────────────────────────────────

export const Radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  full: 9999,
};

// ─── Shadows ──────────────────────────────────────────────────────────────────

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  accentLg: {
    shadowColor: '#E8620A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 10,
  },
};

// ─── Typography ───────────────────────────────────────────────────────────────

export const Typography = {
  h1: { fontSize: 32, fontWeight: '800' as const, letterSpacing: -0.5, color: Colors.text },
  h2: { fontSize: 24, fontWeight: '800' as const, letterSpacing: -0.3, color: Colors.text },
  h3: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.2, color: Colors.text },
  h4: { fontSize: 17, fontWeight: '700' as const, color: Colors.text },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22, color: Colors.text },
  bodySm: { fontSize: 13, fontWeight: '400' as const, lineHeight: 19, color: Colors.textSub },
  caption: { fontSize: 11, fontWeight: '600' as const, color: Colors.textMuted },
  label: { fontSize: 10, fontWeight: '700' as const, letterSpacing: 1.5, textTransform: 'uppercase' as const, color: Colors.textMuted },
};

// ─── Fonts ────────────────────────────────────────────────────────────────────

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});