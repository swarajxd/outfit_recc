/**
 * GlassCard.tsx
 * Reusable premium glassmorphism card component.
 * Uses BlurView + LinearGradient sheen + optional orange accent glow.
 */

import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Colors, Radius } from '../../constants/theme';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  /** BlurView intensity (0–100). Default: 18 */
  intensity?: number;
  /** Whether to show faint orange bottom glow. Default: false */
  accentGlow?: boolean;
  /** Custom glow color. Defaults to orange accent. */
  glowColor?: string;
  /** BorderRadius override. Default: Radius.xl */
  radius?: number;
  /** Show top sheen gradient. Default: true */
  sheen?: boolean;
}

export function GlassCard({
  children,
  style,
  intensity = 18,
  accentGlow = false,
  glowColor = Colors.accent,
  radius = Radius.xl,
  sheen = true,
}: GlassCardProps) {
  const glowRgba = hexToRgba(glowColor, 0.08);

  return (
    <View style={[S.outer, { borderRadius: radius }, style]}>
      {/* Blur backdrop */}
      <BlurView
        intensity={intensity}
        tint="dark"
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />

      {/* Top sheen */}
      {sheen && (
        <LinearGradient
          colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[S.sheen, { borderRadius: radius }]}
        />
      )}

      {/* Optional accent bottom glow */}
      {accentGlow && (
        <LinearGradient
          colors={['rgba(0,0,0,0)', glowRgba]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[S.accentGlow, { borderRadius: radius }]}
        />
      )}

      {/* Border */}
      <View style={[S.border, { borderRadius: radius }]} />

      {/* Content */}
      {children}
    </View>
  );
}

// ─── Minimal solid glass card (no blur — for perf on older devices) ────────────

interface SolidGlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  radius?: number;
}

export function SolidGlassCard({ children, style, radius = Radius.xl }: SolidGlassCardProps) {
  return (
    <View
      style={[
        S.solid,
        { borderRadius: radius },
        style,
      ]}
    >
      <LinearGradient
        colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />
      {children}
    </View>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  outer: {
    overflow: 'hidden',
    backgroundColor: 'rgba(22,22,22,0.55)',
  },
  sheen: {
    ...StyleSheet.absoluteFillObject,
    height: '50%',
  },
  accentGlow: {
    ...StyleSheet.absoluteFillObject,
    top: '50%',
  },
  border: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  solid: {
    overflow: 'hidden',
    backgroundColor: 'rgba(30,30,30,0.85)',
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
