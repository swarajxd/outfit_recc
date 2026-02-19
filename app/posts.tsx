import React from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export default function PostScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          {/* Left Section */}
          <View style={styles.leftHeader}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ marginRight: 16 }}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>

            <Image
              source={require("../assets/img1.jpg")}
              style={styles.avatar}
            />

            <View style={{ marginLeft: 10 }}>
              <Text style={styles.username}>youraccount</Text>
              <Text style={styles.location}>Location Here</Text>
            </View>
          </View>

          {/* Right Icon */}
          <Feather name="more-horizontal" size={22} color="#fff" />
        </View>

        {/* Post Image */}
        <Image
          source={require("../assets/img2.jpg")}
          style={styles.postImage}
        />

        {/* Action Row */}
        <View style={styles.actionRow}>
          <View style={styles.leftActions}>
            <Ionicons name="heart-outline" size={26} color="#fff" />
            <Ionicons name="chatbubble-outline" size={24} color="#fff" />
            <Feather name="send" size={24} color="#fff" />
          </View>

          <Feather name="bookmark" size={24} color="#fff" />
        </View>

        {/* Likes */}
        <Text style={styles.likes}>12,853 likes</Text>

        {/* Caption */}
        <Text style={styles.caption}>
          <Text style={styles.username}>youraccount </Text>
          Enhance your Instagram with our UI Mockup Download for Instagram creativity.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingTop: 30, // 🔥 Increased upper margin
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 18,
  },

  leftHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  avatar: {
    width: 42, // slightly bigger
    height: 42,
    borderRadius: 21,
  },

  username: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },

  location: {
    color: "#888",
    fontSize: 12,
  },

  postImage: {
    width: "100%",
    height: 430,
    resizeMode: "cover",
  },

  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginTop: 14,
  },

  leftActions: {
    flexDirection: "row",
    gap: 18,
  },

  likes: {
    color: "#fff",
    fontWeight: "600",
    paddingHorizontal: 16,
    marginTop: 12,
  },

  caption: {
    color: "#ccc",
    paddingHorizontal: 16,
    marginTop: 6,
    marginBottom: 40,
    lineHeight: 20,
  },
});
