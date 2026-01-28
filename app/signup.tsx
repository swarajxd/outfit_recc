// app/signup.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSignUp } from '@clerk/clerk-expo';
import { Link, useRouter } from 'expo-router';

function safeText(obj: any) {
  try {
    return JSON.stringify(obj, Object.getOwnPropertyNames(obj), 2);
  } catch {
    return String(obj);
  }
}

// Basic client-side password checks to catch easy problems early
function validatePassword(password: string, username: string, email: string) {
  const issues: string[] = [];
  if (!password || password.length < 8) issues.push('Use at least 8 characters.');
  if (password.toLowerCase().includes('password') || password === '12345678') issues.push('Avoid common passwords (e.g. "password", "12345678").');
  if (username && password.toLowerCase().includes(username.toLowerCase())) issues.push('Password should not include your username.');
  if (email && password.includes(email.split('@')[0])) issues.push('Password should not include part of your email.');
  return issues;
}

export default function SignUp() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [step, setStep] = useState<'form' | 'verify'>('form');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!isLoaded) return Alert.alert('Please wait', 'Auth not loaded yet');
    if (!username || !email || !password) return Alert.alert('Missing', 'Fill username, email and password');

    // client-side password checks
    const pwIssues = validatePassword(password, username, email);
    if (pwIssues.length) {
      return Alert.alert('Weak password', pwIssues.join('\n'));
    }

    setLoading(true);
    try {
      if (!signUp) {
        setLoading(false);
        return Alert.alert('Auth not ready', 'Please wait a moment and try again.');
      }

      const res = await signUp.create({
        username,
        emailAddress: email,
        password,
      });

      // Debug-safe log (won't print keys)
      console.log('signUp.create result:', safeText({ status: res?.status, id: res?.id }));

      // If Clerk created a session right away
      if (res?.status === 'complete' && res?.createdSessionId) {
        await setActive({ session: res.createdSessionId });
        router.replace('/home');
        return;
      }

      // If Clerk says email is unverified, request the email code and show verify UI
      // res.unverifiedFields may include 'email_address'
      const unverified = (res as any)?.unverifiedFields ?? [];
      if (Array.isArray(unverified) && unverified.includes('email_address')) {
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        setStep('verify');
        Alert.alert('Code sent', 'A verification code has been sent to your email.');
        return;
      }

      // If Clerk expects more fields
      if (res?.status === 'missing_requirements' && (res as any)?.missingFields?.length) {
        const missing = (res as any).missingFields.join(', ');
        Alert.alert('Missing fields', `Clerk requires: ${missing}`);
        return;
      }

      // If we reach here, show the object to help debugging
      Alert.alert('Sign-up status', `Unexpected signUp response: ${safeText(res)}`);
    } catch (err: any) {
      console.error('signUp error full:', err);

      // Clerk often puts readable message in err.message
      const msg = err?.message || safeText(err);

      // Specific helpful handling for breach-detected password
      if (typeof msg === 'string' && msg.toLowerCase().includes('found in an online data breach')) {
        Alert.alert(
          'Unsafe password',
          'That password has been found in an online data breach. Choose a new, stronger password (try 12+ chars, mix letters/numbers/symbols).'
        );
        setLoading(false);
        return;
      }

      // If there are structured errors, try to present them
      if (err?.errors && Array.isArray(err.errors)) {
        const first = err.errors[0];
        Alert.alert('Sign up failed', first?.message || JSON.stringify(first));
        setLoading(false);
        return;
      }

      // Generic fallback
      Alert.alert('Sign up failed', typeof msg === 'string' ? msg : 'Unknown error (see console).');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      if (!signUp) return Alert.alert('Auth not ready', 'Please wait a moment and try again.');
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      Alert.alert('Sent', 'Verification code resent. Check your email (spam too).');
    } catch (e: any) {
      console.error('resend error', e);
      Alert.alert('Resend failed', e?.message || safeText(e));
    }
  };

  const handleVerify = async () => {
    if (!isLoaded) return Alert.alert('Please wait', 'Auth not loaded yet');
    if (!code) return Alert.alert('Missing code', 'Enter the code you received via email');

    setLoading(true);
    try {
      if (!signUp) {
        setLoading(false);
        return Alert.alert('Auth not ready', 'Please wait a moment and try again.');
      }

      const attempt = await signUp.attemptEmailAddressVerification({ code });
      console.log('attemptEmailAddressVerification result:', safeText(attempt));

      if (attempt?.status === 'complete' && attempt?.createdSessionId) {
        await setActive({ session: attempt.createdSessionId });
        router.replace('/home');
        return;
      }

      if (attempt?.status === 'missing_requirements' && (attempt as any)?.missingFields?.length) {
        Alert.alert('Missing fields', `Clerk requires: ${(attempt as any).missingFields.join(', ')}`);
        setStep('form');
        setLoading(false);
        return;
      }

      Alert.alert('Verification not completed', 'Verification did not return a session. Check console for details.');
      console.warn('Verification attempt object:', attempt);
    } catch (err: any) {
      console.error('verification error:', err);
      const message = err?.message || safeText(err);
      if (typeof message === 'string' && message.toLowerCase().includes('already been verified')) {
        Alert.alert('Already verified', 'Your email is already verified. Please sign in.');
        router.replace('/signin');
      } else {
        Alert.alert('Verification failed', typeof message === 'string' ? message : 'Unknown error (see console).');
      }
    } finally {
      setLoading(false);
    }
  };

  // Verify UI
  if (step === 'verify') {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        <Text style={styles.title}>Verify your email</Text>
        <Text style={{ marginBottom: 8 }}>Code sent to {email}</Text>

        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="Verification code"
          style={styles.input}
          keyboardType="number-pad"
        />

        <TouchableOpacity style={styles.button} onPress={handleVerify} disabled={loading}>
          <Text style={styles.btnText}>{loading ? 'Verifying...' : 'Verify'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, { marginTop: 10, backgroundColor: '#333' }]} onPress={handleResend}>
          <Text style={styles.btnText}>Resend code</Text>
        </TouchableOpacity>

        <View style={{ marginTop: 12 }}>
          <Text>Already have an account?</Text>
          <Link href="/signin">
            <Text style={{ color: '#2563eb' }}> Sign in</Text>
          </Link>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // Sign-up form UI
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <Text style={styles.title}>Sign up</Text>

      <TextInput value={username} onChangeText={setUsername} placeholder="Username" autoCapitalize="none" style={styles.input} />
      <TextInput value={email} onChangeText={setEmail} placeholder="Email" autoCapitalize="none" style={styles.input} keyboardType="email-address" />
      <TextInput value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry style={styles.input} />

      <Text style={{ marginBottom: 8, color: '#666' }}>
        Use 8+ characters, avoid common words. If Clerk still rejects, choose a longer or more unique password.
      </Text>

      <TouchableOpacity style={styles.button} onPress={handleSignUp} disabled={loading}>
        <Text style={styles.btnText}>{loading ? 'Sending code...' : 'Continue'}</Text>
      </TouchableOpacity>

      <View style={{ marginTop: 12 }}>
        <Text>Already have an account?</Text>
        <Link href="/signin">
          <Text style={{ color: '#2563eb' }}> Sign in</Text>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 6, marginBottom: 12 },
  button: { backgroundColor: '#111827', padding: 12, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600' },
});
