/**
 * SkeletonLoader.tsx
 * Animated shimmer skeleton components for loading states throughout FitSense.
 * Replaces ActivityIndicator spinners with premium shimmer placeholders.
 */

import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Animated, Dimensions, StyleSheet, View, ViewStyle } from 'react-native';
import { Colors, Radius, Spacing } from '../../constants/theme';
import { useShimmer } from './AnimUtils';

const { width: SCREEN_W } = Dimensions.get('window');
const SHIMMER_W = SCREEN_W;

// ─── Base Skeleton Box ────────────────────────────────────────────────────────

interface SkeletonBoxProps {
  width?: number | string;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonBox({ width = '100%', height, borderRadius = Radius.sm, style }: SkeletonBoxProps) {
  const shimmerX = useShimmer(SHIMMER_W, 1400);

  return (
    <View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: Colors.surface3,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        style={{
          ...StyleSheet.absoluteFillObject,
          transform: [{ translateX: shimmerX }],
        }}
      >
        <LinearGradient
          colors={[
            'rgba(255,255,255,0.0)',
            'rgba(255,255,255,0.06)',
            'rgba(255,255,255,0.0)',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ width: SHIMMER_W, height: '100%' }}
        />
      </Animated.View>
    </View>
  );
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────

export function SkeletonCard({ style }: { style?: ViewStyle }) {
  return (
    <View style={[S.card, style]}>
      <SkeletonBox height={160} borderRadius={Radius.md} />
      <View style={{ marginTop: Spacing.sm, gap: Spacing.xs }}>
        <SkeletonBox height={14} width="70%" />
        <SkeletonBox height={11} width="45%" />
      </View>
    </View>
  );
}

// ─── Wardrobe Skeleton Grid ───────────────────────────────────────────────────

export function WardrobeSkeletonGrid({ count = 6 }: { count?: number }) {
  const items = Array.from({ length: count });
  const leftCol = items.filter((_, i) => i % 2 === 0);
  const rightCol = items.filter((_, i) => i % 2 !== 0);

  return (
    <View style={S.grid}>
      <View style={S.column}>
        {leftCol.map((_, i) => (
          <SkeletonCard key={`l${i}`} style={{ marginBottom: Spacing.sm }} />
        ))}
      </View>
      <View style={S.column}>
        {rightCol.map((_, i) => (
          <SkeletonCard key={`r${i}`} style={{ marginBottom: Spacing.sm, marginTop: Spacing.xl }} />
        ))}
      </View>
    </View>
  );
}

// ─── Home Skeleton Section ────────────────────────────────────────────────────

export function HomeSkeletonSection() {
  return (
    <View style={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, gap: Spacing.xl }}>
      {/* Greeting */}
      <View style={{ gap: Spacing.xs }}>
        <SkeletonBox height={12} width="35%" />
        <SkeletonBox height={28} width="65%" />
        <SkeletonBox height={18} width="80%" />
      </View>

      {/* Hero Card */}
      <SkeletonBox height={220} borderRadius={Radius.xl} />

      {/* Quick Actions */}
      <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
        {[0, 1, 2, 3].map((i) => (
          <SkeletonBox key={i} height={72} width={72} borderRadius={Radius.lg} />
        ))}
      </View>

      {/* Section heading */}
      <SkeletonBox height={11} width="40%" />

      {/* Cards row */}
      <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
        <SkeletonBox height={170} width={(SCREEN_W - Spacing.lg * 2 - Spacing.sm) / 2} borderRadius={Radius.lg} />
        <SkeletonBox height={170} width={(SCREEN_W - Spacing.lg * 2 - Spacing.sm) / 2} borderRadius={Radius.lg} />
      </View>
    </View>
  );
}

// ─── Profile Skeleton ─────────────────────────────────────────────────────────

export function ProfileSkeletonSection() {
  return (
    <View style={{ padding: Spacing.lg, gap: Spacing.lg, alignItems: 'center' }}>
      <SkeletonBox height={88} width={88} borderRadius={44} />
      <SkeletonBox height={20} width={140} />
      <SkeletonBox height={14} width={200} />
      <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
        {[0, 1, 2].map((i) => (
          <SkeletonBox key={i} height={56} width={80} borderRadius={Radius.md} />
        ))}
      </View>
    </View>
  );
}

// ─── AI Message Skeleton ──────────────────────────────────────────────────────

export function AIMessageSkeleton() {
  return (
    <View style={{ gap: Spacing.xs, marginBottom: Spacing.md }}>
      <SkeletonBox height={11} width="25%" />
      <SkeletonBox height={64} borderRadius={Radius.md} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface2,
    borderRadius: Radius.lg,
    padding: Spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  column: {
    flex: 1,
    gap: Spacing.sm,
  },
});
