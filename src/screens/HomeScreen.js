// src/screens/HomeScreen.js
import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { useUser, useClerk } from '@clerk/clerk-expo';

export default function HomeScreen() {
  const { user } = useUser();
  const { signOut } = useClerk();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome{user?.firstName ? `, ${user.firstName}` : ''}!</Text>
      <Text style={{ marginBottom: 16 }}>This is your protected home screen.</Text>
      <Button title="Sign out" onPress={() => signOut()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
});
