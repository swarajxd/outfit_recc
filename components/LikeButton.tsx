import React, { useRef, useEffect } from 'react';
import {
  TouchableOpacity,
  Animated,
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface LikeButtonProps {
  liked: boolean;
  likesCount: number;
  onPress: () => void;
  style?: any;
}

export default function LikeButton({
  liked,
  likesCount,
  onPress,
  style,
}: LikeButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const heartbeatAnim = useRef(new Animated.Value(0)).current;

  // Trigger heart animation when liked
  useEffect(() => {
    if (liked) {
      // Scale up animation
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.3,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Heartbeat pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(heartbeatAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(heartbeatAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
        {
          iterations: 1,
        },
      ).start();
    } else {
      scaleAnim.setValue(1);
      heartbeatAnim.setValue(0);
    }
  }, [liked, scaleAnim, heartbeatAnim]);

  const animatedScale = scaleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.3],
  });

  const opacity = heartbeatAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0.6, 1],
  });

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.container, style]}
      activeOpacity={0.7}
    >
      <View style={styles.iconContainer}>
        <Animated.View
          style={{
            transform: [{ scale: animatedScale }],
            opacity: opacity,
          }}
        >
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={24}
            color={liked ? '#ff4757' : '#fff'}
          />
        </Animated.View>

        {/* Like count badge */}
        {likesCount > 0 && (
          <Animated.Text
            style={[
              styles.countBadge,
              {
                transform: [{ scale: animatedScale }],
              },
            ]}
          >
            {likesCount}
          </Animated.Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  countBadge: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
