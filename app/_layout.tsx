// app/_layout.tsx
import 'react-native-url-polyfill/auto';
import React from 'react';
import { Slot } from 'expo-router';
import Constants from 'expo-constants';
import { ClerkProvider } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';

export default function Layout() {
  const publishableKey =
    Constants?.expoConfig?.extra?.CLERK_PUBLISHABLE_KEY ||
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    // show nothing if key missing (avoid logging the key).
    return null;
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <Slot />
    </ClerkProvider>
  );
}
