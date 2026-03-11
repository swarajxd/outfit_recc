
import React, { useRef } from "react";

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

  const translateY = useRef(new Animated.Value(0)).current;

  const animateIn = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1.04,
        useNativeDriver: true,
        friction: 6,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: -6,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const animateOut = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 6,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,

      }),
    ]).start();
  };


  const ratios = [0.75, 1, 0.85, 1.2];

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

            <Ionicons name="heart-outline" size={20} color="#fff" />
            <Ionicons name="bookmark-outline" size={20} color="#fff" />
          </View>

          <View style={styles.textContainer}>
            <Text style={styles.username}>{post.author}</Text>
            <Text style={styles.caption}>{post.caption}</Text>

          </View>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {

    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#141418",
    marginBottom: 24,

    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,

  },
  image: {
    width: "100%",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,

    backgroundColor: "rgba(0,0,0,0.45)",
    padding: 16,

    justifyContent: "space-between",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",

    gap: 14,
  },

  textContainer: {
    marginTop: "auto",
  },
  username: {
    color: "#fff",

    fontWeight: "600",
    fontSize: 14,
  },
  caption: {
    color: "#ccc",
    fontSize: 12,
    marginTop: 4,

  },
});
