/**
 * GradientButton.tsx
 * Premium gradient button with shadow glow and press animation.
 */

import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { Colors, Gradients, Radius, Shadows, Spacing, Typography } from '../../constants/theme';
import { useHapticPress } from './AnimUtils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface GradientButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  style?: ViewStyle;
  small?: boolean;
}

export function GradientButton({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  style,
  small = false,
}: GradientButtonProps) {
  const { scale, onPressIn, onPressOut } = useHapticPress(0.96, 'medium');

  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  const isGhost = variant === 'ghost';
  const isDanger = variant === 'danger';

  const gradientColors: [string, string] =
    isPrimary ? [...Gradients.accentSoft] as [string, string]
    : isDanger ? ['#FF4D4D', '#C0392B'] as [string, string]
    : ['rgba(40,40,40,0.9)', 'rgba(28,28,28,0.9)'] as [string, string];

  return (
    <Animated.View
      style={[
        S.wrapper,
        small && S.wrapperSmall,
        isPrimary && Shadows.accentLg,
        { transform: [{ scale }], opacity: disabled ? 0.4 : 1 },
        style,
      ]}
    >
      <TouchableOpacity
        onPress={disabled || loading ? undefined : onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
        disabled={disabled || loading}
        style={S.touchable}
      >
        {isPrimary || isDanger ? (
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[S.inner, small && S.innerSmall]}
          >
            <ButtonContent label={label} icon={icon} loading={loading} light small={small} />
          </LinearGradient>
        ) : (
          <Animated.View
            style={[
              S.inner,
              small && S.innerSmall,
              isGhost && S.innerGhost,
              isSecondary && S.innerSecondary,
            ]}
          >
            <ButtonContent label={label} icon={icon} loading={loading} light={false} small={small} />
          </Animated.View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

function ButtonContent({
  label,
  icon,
  loading,
  light,
  small,
}: {
  label: string;
  icon?: string;
  loading: boolean;
  light: boolean;
  small: boolean;
}) {
  const textColor = light ? '#fff' : Colors.textMuted;

  return loading ? (
    <ActivityIndicator size="small" color={light ? '#fff' : Colors.accent} />
  ) : (
    <>
      {icon && (
        <Text style={[S.icon, small && { fontSize: 14 }, { color: textColor }]}>{icon}</Text>
      )}
      <Text
        style={[
          S.label,
          small && S.labelSmall,
          { color: textColor },
        ]}
      >
        {label}
      </Text>
    </>
  );
}

const S = StyleSheet.create({
  wrapper: {
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  wrapperSmall: {
    borderRadius: Radius.lg,
  },
  touchable: {
    width: '100%',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  innerSmall: {
    height: 38,
    paddingHorizontal: Spacing.base,
  },
  innerGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border3,
  },
  innerSecondary: {
    backgroundColor: Colors.surface3,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  icon: {
    fontSize: 16,
  },
  label: {
    ...Typography.h4,
    letterSpacing: 0.5,
  },
  labelSmall: {
    fontSize: 13,
    fontWeight: '600',
  },
});
