// src/screens/SignUpScreen.js
import React, { useState } from 'react';
import { View, Text, TextInput, Button, Alert, StyleSheet } from 'react-native';
import { useSignUp } from '@clerk/clerk-expo';

export default function SignUpScreen({ navigation }) {
  const { isLoaded, signUp, setActive } = useSignUp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!isLoaded) return;
    if (!email || !password) return Alert.alert('Error', 'Enter email and password');
    setLoading(true);
    try {
      const res = await signUp.create({ emailAddress: email, password });
      if (res?.createdSessionId) {
        await setActive({ session: res.createdSessionId });
        navigation.replace('Home');
      } else {
        Alert.alert('Check your email', 'A verification step may be required to complete signup.');
      }
    } catch (err) {
      Alert.alert('Sign up failed', err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign up</Text>
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        style={styles.input}
        secureTextEntry
      />
      <Button title={loading ? 'Signing up...' : 'Sign up'} onPress={handleSignUp} />
      <View style={{ height: 12 }} />
      <Button title="Already have an account? Sign in" onPress={() => navigation.navigate('SignIn')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 6, marginBottom: 12 },
});
