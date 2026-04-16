/**
 * AnimatedChip.tsx
 * Reusable animated pill chip with orange active state and press bounce.
 */

import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../../constants/theme';
import { useSpringBounce } from './AnimUtils';

interface AnimatedChipProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: string;
  style?: ViewStyle;
  small?: boolean;
}

export function AnimatedChip({
  label,
  active = false,
  onPress,
  icon,
  style,
  small = false,
}: AnimatedChipProps) {
  const { scale, bounce } = useSpringBounce();

  const handlePress = () => {
    bounce();
    onPress?.();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.8}
        style={[
          S.chip,
          small && S.chipSmall,
          active && S.chipActive,
        ]}
      >
        {active && (
          <LinearGradient
            colors={['rgba(232,98,10,0.22)', 'rgba(232,98,10,0.08)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}

        {icon && (
          <Text style={[S.icon, small && S.iconSmall]}>{icon}</Text>
        )}

        <Text
          style={[
            S.label,
            small && S.labelSmall,
            active && S.labelActive,
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const S = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface3,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  chipSmall: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  chipActive: {
    borderColor: `${Colors.accent}55`,
    backgroundColor: 'transparent',
  },
  icon: {
    fontSize: 14,
  },
  iconSmall: {
    fontSize: 12,
  },
  label: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  labelSmall: {
    fontSize: 11,
  },
  labelActive: {
    color: Colors.accent,
  },
});
