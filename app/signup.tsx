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

export default function SignUp() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [step, setStep] = useState<'form' | 'verify'>('form');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  // Start sign-up and request OTP
  const handleSignUp = async () => {
    if (!isLoaded) return Alert.alert('Please wait', 'Auth not loaded yet');
    if (!username || !email || !password) return Alert.alert('Missing', 'Fill username, email and password');

    setLoading(true);
    try {
      // Include username here because your project requires it
      const res = await signUp.create({
        username,
        emailAddress: email,
        password,
      });

      // signUp.create returns sign-up attempt; inspect status
      console.log('signUp.create result:', safeText({ status: res?.status, id: res?.id }));

      // If Clerk still reports missing fields, show them
      if (res?._status === 'missing_requirements' && res?.missingFields?.length) {
        Alert.alert('Missing fields', `Clerk requires: ${res.missingFields.join(', ')}`);
        // keep in form state so user can fix it
        setLoading(false);
        return;
      }

      // send OTP (email_code)
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });

      setStep('verify');
      Alert.alert('Code sent', 'A verification code has been sent to your email.');
    } catch (err: any) {
      console.error('signUp error full:', err);
      // Surface helpful message
      Alert.alert('Sign up failed', err?.message || safeText(err));
    } finally {
      setLoading(false);
    }
  };

  // Resend verification code
  const handleResend = async () => {
    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      Alert.alert('Sent', 'Verification code resent. Check your email (spam too).');
    } catch (e: any) {
      console.error('resend error', e);
      Alert.alert('Resend failed', e?.message || safeText(e));
    }
  };

  // Attempt to verify the OTP code
  const handleVerify = async () => {
    if (!isLoaded) return Alert.alert('Please wait', 'Auth not loaded yet');
    if (!code) return Alert.alert('Missing code', 'Enter the code you received via email');

    setLoading(true);
    try {
      const attempt = await signUp.attemptEmailAddressVerification({ code });
      console.log('attemptEmailAddressVerification result:', safeText(attempt));

      // If the sign-up attempt is complete and Clerk created a session — success
      if (attempt?.status === 'complete' && attempt?.createdSessionId) {
        await setActive({ session: attempt.createdSessionId });
        router.replace('/home');
        return;
      }

      // If Clerk still lists missing fields (rare here), tell user
      if (attempt?._status === 'missing_requirements' && attempt?.missingFields?.length) {
        Alert.alert('Missing fields', `Clerk requires: ${attempt.missingFields.join(', ')}`);
        // switch back to form so user can fill them (we already collected username; but handle generically)
        setStep('form');
        setLoading(false);
        return;
      }

      // If verification was already verified (common if user clicked a magic link or re-used code),
      // Clerk might throw "This verification has already been verified." We detect that via thrown error.
      // In that case suggest the user to sign in (maybe the account is already active).
      Alert.alert('Verification not completed', 'Verification did not return a session. Check console for details.');
      console.warn('Verification attempt object:', attempt);
    } catch (err: any) {
      console.error('verification error full:', err);

      // Friendly handling for "This verification has already been verified."
      const message = err?.message || safeText(err);
      if (message && message.toLowerCase().includes('already been verified')) {
        Alert.alert(
          'Already verified',
          'Your email is already verified. Try signing in. If that fails, check the Clerk dashboard or use a fresh email.'
        );
        // Go to sign-in to let user try sign in immediately
        router.replace('/signin');
      } else {
        Alert.alert('Verification failed', message);
      }
    } finally {
      setLoading(false);
    }
  };

  // UI: verification step
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

  // UI: initial form with username
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <Text style={styles.title}>Sign up</Text>

      <TextInput value={username} onChangeText={setUsername} placeholder="Username" autoCapitalize="none" style={styles.input} />
      <TextInput value={email} onChangeText={setEmail} placeholder="Email" autoCapitalize="none" style={styles.input} keyboardType="email-address" />
      <TextInput value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry style={styles.input} />

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
