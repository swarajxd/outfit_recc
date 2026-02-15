import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

export default function PostCard({ post, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const shadowOpacity = useRef(new Animated.Value(0.2)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  
  const likeScale = useRef(new Animated.Value(1)).current;
  const saveScale = useRef(new Animated.Value(1)).current;
  const likeButtonBg = useRef(new Animated.Value(0)).current;
  const saveButtonBg = useRef(new Animated.Value(0)).current;

  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const animateIn = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1.05,
        useNativeDriver: true,
        friction: 6,
        tension: 70,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(shadowOpacity, {
        toValue: 0.4,
        duration: 280,
        useNativeDriver: false,
      }),
      Animated.spring(translateY, {
        toValue: -10,
        useNativeDriver: true,
        friction: 6,
      }),
    ]).start();
  };

  const animateOut = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 6,
        tension: 70,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(shadowOpacity, {
        toValue: 0.2,
        duration: 220,
        useNativeDriver: false,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        friction: 6,
      }),
    ]).start();
  };

  const animateLike = () => {
    setIsLiked(!isLiked);
    Animated.sequence([
      Animated.spring(likeScale, {
        toValue: 1.3,
        useNativeDriver: true,
        friction: 4,
        tension: 80,
      }),
      Animated.spring(likeScale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 5,
      }),
    ]).start();

    Animated.timing(likeButtonBg, {
      toValue: !isLiked ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const animateSave = () => {
    setIsSaved(!isSaved);
    Animated.sequence([
      Animated.spring(saveScale, {
        toValue: 1.3,
        useNativeDriver: true,
        friction: 4,
        tension: 80,
      }),
      Animated.spring(saveScale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 5,
      }),
    ]).start();

    Animated.timing(saveButtonBg, {
      toValue: !isSaved ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const ratios = [0.75, 1, 0.85, 1.2, 0.9, 1.1];
  const ratio =
    ratios[parseInt(post.id.replace("local-", "")) % ratios.length];

  return (
    <Pressable
      onPress={() => onPress(post)}
      onHoverIn={animateIn}
      onHoverOut={animateOut}
    >
      <Animated.View
        style={[
          styles.card,
          {
            transform: [{ scale }, { translateY }],
            shadowOpacity,
          },
        ]}
      >
        <Image
          source={post.image}
          style={[styles.image, { aspectRatio: ratio }]}
          contentFit="cover"
        />

        <Animated.View
          style={[
            styles.overlay,
            { opacity: overlayOpacity },
          ]}
        >
          <View style={styles.actions}>
            <Animated.View style={{ transform: [{ scale: likeScale }] }}>
              <Animated.View
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: likeButtonBg.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["rgba(255, 105, 135, 0.15)", "rgba(255, 45, 85, 0.85)"],
                    }),
                  },
                ]}
              >
                <Pressable onPress={animateLike} style={styles.buttonInner}>
                  <Ionicons
                    name={isLiked ? "heart" : "heart-outline"}
                    size={24}
                    color={isLiked ? "#fff" : "#fff"}
                  />
                </Pressable>
              </Animated.View>
            </Animated.View>

            <Animated.View style={{ transform: [{ scale: saveScale }] }}>
              <Animated.View
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: saveButtonBg.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["rgba(255, 195, 0, 0.15)", "rgba(255, 180, 0, 0.85)"],
                    }),
                  },
                ]}
              >
                <Pressable onPress={animateSave} style={styles.buttonInner}>
                  <Ionicons
                    name={isSaved ? "bookmark" : "bookmark-outline"}
                    size={24}
                    color={isSaved ? "#fff" : "#fff"}
                  />
                </Pressable>
              </Animated.View>
            </Animated.View>
          </View>

          <View style={styles.textContainer}>
            <Text style={styles.username}>{post.author}</Text>
            <Text style={styles.caption} numberOfLines={2}>{post.caption}</Text>
          </View>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
    marginBottom: 0,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
  image: {
    width: "100%",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    padding: 12,
    justifyContent: "space-between",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    backdropFilter: "blur(12px)",
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  buttonInner: {
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    height: "100%",
  },
  textContainer: {
    marginTop: "auto",
  },
  username: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
    letterSpacing: 0.4,
  },
  caption: {
    color: "#d0d0d0",
    fontSize: 13,
    marginTop: 6,
    fontWeight: "500",
    lineHeight: 17,
  },
});
