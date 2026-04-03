// app/index.tsx
import { useAuth, useUser } from "@clerk/clerk-expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

export default function Index() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const [isChecking, setIsChecking] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  useEffect(() => {
    checkOnboarding();
  }, [isSignedIn, user?.id]);

  const checkOnboarding = async () => {
    if (!isSignedIn) {
      setIsChecking(false);
      return;
    }

    if (!user?.id) return;

    try {
      // 1. Clerk metadata says done
      const clerkDone = (user.unsafeMetadata as any)?.onboardingComplete;
      if (clerkDone === true) {
        setOnboardingComplete(true);
        setIsChecking(false);
        return;
      }

      // 2. Local storage says done
      const localDone = await AsyncStorage.getItem("fitsense_onboarding_complete");
      if (localDone === "true") {
        setOnboardingComplete(true);
        setIsChecking(false);
        return;
      }

      // 3. Existing account (older than 2 minutes) → skip onboarding
      const accountAgeMs = Date.now() - new Date(user.createdAt!).getTime();
      const isExistingUser = accountAgeMs > 2 * 60 * 1000;
      if (isExistingUser) {
        // Cache it so we don't re-check next time
        await AsyncStorage.setItem("fitsense_onboarding_complete", "true");
        setOnboardingComplete(true);
        setIsChecking(false);
        return;
      }

      // 4. Brand new account — show onboarding
      setOnboardingComplete(false);
    } catch (e) {
      console.log("Onboarding check error:", e);
      // On any error, don't block existing users
      setOnboardingComplete(true);
    } finally {
      setIsChecking(false);
    }
  };

  if (!isLoaded || isChecking) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0a0a0a" }}>
        <ActivityIndicator size="large" color="#FF6B00" />
      </View>
    );
  }

  if (isSignedIn) {
    return onboardingComplete
      ? <Redirect href="/(tabs)/home" />
      : <Redirect href="/pref" />;
  }

  return <Redirect href="/signin" />;
}