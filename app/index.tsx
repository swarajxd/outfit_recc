// app/index.tsx
import { useAuth, useUser } from "@clerk/clerk-expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";

type Destination = "home" | "pref" | "signin" | null;

export default function Index() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const [destination, setDestination] = useState<Destination>(null);
  const checkedForUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn || !user?.id) {
      setDestination("signin");
      checkedForUserId.current = null;
      return;
    }

    // Don't re-run if we already completed the check for this user
    if (checkedForUserId.current === user.id) return;

    const userId = user.id;
    checkedForUserId.current = userId;

    // Reset destination to null (shows spinner) while we check
    setDestination(null);

    const check = async () => {
      const cacheKey = `fitsense_pref_done_${userId}`;

      try {
        // 1. Fast path: local cache
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached === "true") {
          setDestination("home");
          return;
        }

        // 2. DB check
        const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:4000";
        const res = await fetch(
          `${apiBase}/api/profile/preferences/${encodeURIComponent(userId)}`,
          { headers: { "x-user-id": userId } }
        );

        if (res.ok) {
          const json = await res.json();
          if (json.onboarding_complete === true) {
            await AsyncStorage.setItem(cacheKey, "true");
            setDestination("home");
            return;
          }
        }
      } catch (err) {
        console.warn("[index] check failed:", err);
      }

      setDestination("pref");
    };

    check();
  }, [isLoaded, isSignedIn, user?.id]);

  // Show spinner until we know where to go
  if (destination === null) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0a0a0a" }}>
        <ActivityIndicator size="large" color="#FF6B00" />
      </View>
    );
  }

  if (destination === "home") return <Redirect href="/(tabs)/home" />;
  if (destination === "pref") return <Redirect href="/pref" />;
  return <Redirect href="/signin" />;
}