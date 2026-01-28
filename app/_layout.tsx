// app/_layout.tsx
import 'react-native-url-polyfill/auto';
import React from 'react';
import { Slot } from 'expo-router';
import Constants from 'expo-constants';
import { ClerkProvider } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';

export default function Layout() {
  const publishableKey =
    Constants?.expoConfig?.extra?.CLERK_PUBLISHABLE_KEY ||
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) return null;

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <Slot />
      <GlobalCreateFab />
    </ClerkProvider>
  );
}

function GlobalCreateFab() {
  const router = useRouter();
  const { user } = useUser();

  // Show only for signed-in users
  if (!user?.id) return null;

  return (
    <View pointerEvents="box-none" style={styles.fabContainer}>
      <TouchableOpacity
        onPress={() => router.push('/create-post')}
        style={styles.fab}
        accessibilityLabel="Create post"
      >
        <Text style={styles.fabText}>＋</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    zIndex: 1000,
  },
  fab: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  fabText: {
    fontSize: 32,
    lineHeight: 32,
    color: '#000',
    fontWeight: '700',
  },
});
