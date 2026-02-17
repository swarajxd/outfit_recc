// app/index.tsx
import { useAuth } from "@clerk/clerk-expo";
import { Redirect } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";

export default function Index() {
  const { isSignedIn, isLoaded } = useAuth();

  // Show loading while checking auth status
  if (!isLoaded) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#0a0a0a",
        }}
      >
        <ActivityIndicator size="large" color="#FF8C42" />
      </View>
    );
  }

  // Redirect based on authentication status
  if (isSignedIn) {
    return <Redirect href="/home" />;
  }

  return <Redirect href="/signin" />;
}
