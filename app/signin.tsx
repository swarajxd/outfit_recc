// app/signin.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useSignIn } from '@clerk/clerk-expo';
import { Link, useRouter } from 'expo-router';

function safeText(obj: any) {
  try {
    return JSON.stringify(obj, Object.getOwnPropertyNames(obj), 2);
  } catch {
    return String(obj);
  }
}

export default function SignIn() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!isLoaded) return Alert.alert('Please wait', 'Auth SDK not ready');
    if (!email || !password) return Alert.alert('Missing', 'Enter email and password');

    setLoading(true);
    try {
      const attempt = await signIn.create({ identifier: email, password });
      console.log('signIn.create result:', safeText({ status: attempt?.status, id: attempt?.id }));

      if (attempt?.status === 'complete' && attempt?.createdSessionId) {
        await setActive({ session: attempt.createdSessionId });
        router.replace('/home');
      } else {
        // Not complete — usually this means additional verification (OTP)
        Alert.alert('Additional verification required', safeText(attempt));
        console.warn('signIn.create not complete, object:', attempt);
      }
    } catch (err: any) {
      console.error('signIn error full:', err);
      // Clerk returns useful error objects — surface the message
      Alert.alert('Sign in failed', err?.message || safeText(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign in</Text>
      <TextInput value={email} onChangeText={setEmail} placeholder="Email" autoCapitalize="none" style={styles.input} />
      <TextInput value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry style={styles.input} />
      <TouchableOpacity style={styles.button} onPress={handleSignIn} disabled={loading}>
        <Text style={styles.btnText}>{loading ? 'Signing in...' : 'Continue'}</Text>
      </TouchableOpacity>

      <View style={{ marginTop: 12 }}>
        <Link href="/signup"><Text style={{ color: '#2563eb' }}>Sign up</Text></Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 6, marginBottom: 12 },
  button: { backgroundColor: '#111827', padding: 12, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600' },
});
