// app/home.tsx
import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { useUser, useClerk } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';

export default function Home() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome{user?.firstName ? `, ${user.firstName}` : ''}!</Text>
      <Text style={{ marginBottom: 16 }}>You are signed in.</Text>
      <Button
        title="Sign out"
        onPress={async () => {
          try {
            await signOut();
            router.replace('/signin');
          } catch (err) {
            console.error('signOut error', err);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
});
