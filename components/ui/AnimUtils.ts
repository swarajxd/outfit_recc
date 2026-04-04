/**
 * AnimUtils.ts — Reusable animation hooks for FitSense premium UI
 * Centralizes all common animation patterns to avoid duplication.
 */

import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { Anim } from '../../constants/theme';

// ─── Press Scale Hook ─────────────────────────────────────────────────────────
/**
 * Returns a scale Animated.Value + onPressIn/onPressOut handlers
 * for a smooth press-down → release spring effect.
 */
export function usePressScale(toValue = 0.96) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      ...Anim.springSnappy,
    }).start();

  const onPressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      ...Anim.springBouncy,
    }).start();

  return { scale, onPressIn, onPressOut };
}

// ─── Float Animation Hook ─────────────────────────────────────────────────────
/**
 * Smooth looping float (vertical bob) animation.
 * Returns an interpolated translateY value.
 */
export function useFloatAnim(distance = 8, duration = 3000) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration, useNativeDriver: true }),
      ]),
    ).start();
    return () => anim.stopAnimation();
  }, []);

  return anim.interpolate({ inputRange: [0, 1], outputRange: [0, -distance] });
}

// ─── Entry Animation Hook ─────────────────────────────────────────────────────
/**
 * Fade + slide-up entry animation.
 * Returns an Animated.Value (0→1) to use for opacity + translateY interpolates.
 */
export function useEntryAnim(delay = 0, duration = Anim.slow) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration,
      delay,
      useNativeDriver: true,
    }).start();
  }, []);

  return anim;
}

// ─── Stagger Entry Animation Hook ─────────────────────────────────────────────
/**
 * Stagger-animates a list of items into view.
 * Returns array of Animated.Values (0→1).
 */
export function useStaggerAnims(count: number, staggerDelay = 60, duration = 300) {
  const anims = useRef(Array.from({ length: count }, () => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.stagger(
      staggerDelay,
      anims.map((a) =>
        Animated.timing(a, { toValue: 1, duration, useNativeDriver: true }),
      ),
    ).start();
  }, []);

  return anims;
}

// ─── Shimmer Hook ─────────────────────────────────────────────────────────────
/**
 * Looping shimmer effect for skeleton loaders.
 * Returns interpolated translateX value for a gradient sweep.
 */
export function useShimmer(width = 300, duration = 1200) {
  const anim = useRef(new Animated.Value(-width)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(anim, {
        toValue: width,
        duration,
        useNativeDriver: true,
      }),
    ).start();
    return () => anim.stopAnimation();
  }, [width, duration]);

  return anim;
}

// ─── Pulse Animation Hook ─────────────────────────────────────────────────────
/**
 * Looping opacity pulse for glowing/breathing effects.
 */
export function usePulseAnim(minOpacity = 0.4, maxOpacity = 1, duration = 1500) {
  const anim = useRef(new Animated.Value(minOpacity)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: maxOpacity, duration, useNativeDriver: true }),
        Animated.timing(anim, { toValue: minOpacity, duration, useNativeDriver: true }),
      ]),
    ).start();
    return () => anim.stopAnimation();
  }, []);

  return anim;
}

// ─── Count Up Animation Hook ──────────────────────────────────────────────────
/**
 * Animates a number from 0 to target.
 * Returns an Animated.Value you can use with AnimatedText via listener.
 */
export function useCountUp(target: number, duration = 1200) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: target,
      duration,
      useNativeDriver: false,
    }).start();
  }, [target]);

  return anim;
}

// ─── Haptic Press Hook ────────────────────────────────────────────────────────
/**
 * Combined haptic + scale press animation.
 * Fires haptic feedback on press-in.
 */
export function useHapticPress(
  toValue = 0.96,
  hapticType: 'light' | 'medium' | 'heavy' = 'light',
) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Haptics.impactAsync(
      hapticType === 'light'
        ? Haptics.ImpactFeedbackStyle.Light
        : hapticType === 'medium'
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Heavy,
    );
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      ...Anim.springSnappy,
    }).start();
  };

  const onPressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      ...Anim.springBouncy,
    }).start();

  return { scale, onPressIn, onPressOut };
}

// ─── Spring Bounce (one-shot) ────────────────────────────────────────────────
/**
 * One-shot spring bounce — press-down then spring back.
 * Useful for toggle/select actions.
 */
export function useSpringBounce() {
  const scale = useRef(new Animated.Value(1)).current;

  const bounce = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.94, duration: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
    ]).start();
  };

  return { scale, bounce };
}
