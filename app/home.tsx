// app/home.tsx
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from "react-native";
import { useUser, useClerk } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";

export default function Home() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Welcome{user?.firstName ? `, ${user.firstName}` : ""}!
      </Text>

      <Text style={styles.subtitle}>You are signed in.</Text>

      {/* Discover Button */}
      <Pressable
        style={({ pressed }) => [
          styles.primaryButton,
          pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
        ]}
        onPress={() => router.push("/discover")}
      >
        <Text style={styles.primaryButtonText}>
          Go to Discover
        </Text>
      </Pressable>

      {/* Sign Out Button */}
      <Pressable
        style={({ pressed }) => [
          styles.secondaryButton,
          pressed && { opacity: 0.7 },
        ]}
        onPress={async () => {
          try {
            await signOut();
            router.replace("/signin");
          } catch (err) {
            console.error("signOut error", err);
          }
        }}
      >
        <Text style={styles.secondaryButtonText}>
          Sign Out
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f0f12",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
  },

  subtitle: {
    color: "#aaa",
    marginBottom: 40,
  },

  primaryButton: {
    backgroundColor: "#ffffff",
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 30,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },

  primaryButtonText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "600",
  },

  secondaryButton: {
    borderWidth: 1,
    borderColor: "#333",
    paddingVertical: 12,
    paddingHorizontal: 36,
    borderRadius: 30,
  },

  secondaryButtonText: {
    color: "#aaa",
    fontSize: 14,
    fontWeight: "500",
  },
});
