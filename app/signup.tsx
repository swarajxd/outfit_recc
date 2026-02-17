// app/signup.tsx
import { useAuth, useOAuth, useSignUp } from "@clerk/clerk-expo";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Link, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";

// Required for OAuth to work properly
WebBrowser.maybeCompleteAuthSession();

const { width, height } = Dimensions.get("window");

// Google Icon Component
const GoogleIcon = ({ size = 20 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <Path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <Path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <Path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </Svg>
);

// Apple Icon Component
const AppleIcon = ({
  size = 20,
  color = "#FFFFFF",
}: {
  size?: number;
  color?: string;
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
      fill={color}
    />
  </Svg>
);

function safeText(obj: any) {
  try {
    return JSON.stringify(obj, Object.getOwnPropertyNames(obj), 2);
  } catch {
    return String(obj);
  }
}

function validatePassword(password: string, username: string, email: string) {
  const issues: string[] = [];
  if (!password || password.length < 8)
    issues.push("Use at least 8 characters.");
  if (password.toLowerCase().includes("password") || password === "12345678")
    issues.push('Avoid common passwords (e.g. "password", "12345678").');
  if (username && password.toLowerCase().includes(username.toLowerCase()))
    issues.push("Password should not include your username.");
  if (email && password.includes(email.split("@")[0]))
    issues.push("Password should not include part of your email.");
  return issues;
}

export default function SignUp() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const { isSignedIn, signOut } = useAuth();
  const router = useRouter();

  // OAuth hooks
  const { startOAuthFlow: startGoogleOAuth } = useOAuth({
    strategy: "oauth_google",
  });
  const { startOAuthFlow: startAppleOAuth } = useOAuth({
    strategy: "oauth_apple",
  });

  // Sign out any existing Clerk session when signup page loads
  useEffect(() => {
    signOut();
  }, []);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"form" | "verify">("form");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const orbRotation = useRef(new Animated.Value(0)).current;

  // Focus states
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Redirect if already signed in
  useEffect(() => {
    if (isSignedIn) {
      router.replace("/home");
    }
  }, [isSignedIn]);

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 1000,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse animation for background
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 4000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 4000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // Rotation animation
    Animated.loop(
      Animated.timing(orbRotation, {
        toValue: 1,
        duration: 20000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, []);

  const spin = orbRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const handleOAuthSignIn = async (
    strategy: "oauth_google" | "oauth_apple",
  ) => {
    try {
      setLoading(true);
      const oAuthFlow =
        strategy === "oauth_google" ? startGoogleOAuth : startAppleOAuth;

      const { createdSessionId, setActive: oAuthSetActive } = await oAuthFlow();

      if (createdSessionId) {
        await oAuthSetActive!({ session: createdSessionId });
        router.replace("/home");
      }
    } catch (err: any) {
      console.error("OAuth error:", err);
      const errorMessage =
        err?.errors?.[0]?.message || err?.message || "OAuth sign-in failed";
      Alert.alert("Sign-in Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!isLoaded) return Alert.alert("Please wait", "Auth not loaded yet");
    if (!username || !email || !password)
      return Alert.alert(
        "Missing Fields",
        "Please fill in all fields to continue",
      );

    const pwIssues = validatePassword(password, username, email);
    if (pwIssues.length) {
      return Alert.alert("Weak Password", pwIssues.join("\n"));
    }

    setLoading(true);
    try {
      if (!signUp) {
        setLoading(false);
        return Alert.alert(
          "Auth not ready",
          "Please wait a moment and try again.",
        );
      }

      const res = await signUp.create({
        username,
        emailAddress: email,
        password,
      });

      console.log(
        "signUp.create result:",
        safeText({ status: res?.status, id: res?.id }),
      );

      if (res?.status === "complete" && res?.createdSessionId) {
        await setActive({ session: res.createdSessionId });
        router.replace("/home");
        return;
      }

      const unverified = (res as any)?.unverifiedFields ?? [];
      if (Array.isArray(unverified) && unverified.includes("email_address")) {
        await signUp.prepareEmailAddressVerification({
          strategy: "email_code",
        });
        setStep("verify");
        Alert.alert(
          "Code Sent",
          "A verification code has been sent to your email.",
        );
        return;
      }

      if (
        res?.status === "missing_requirements" &&
        (res as any)?.missingFields?.length
      ) {
        const missing = (res as any).missingFields.join(", ");
        Alert.alert("Missing fields", `Clerk requires: ${missing}`);
        return;
      }

      Alert.alert(
        "Sign-up status",
        `Unexpected signUp response: ${safeText(res)}`,
      );
    } catch (err: any) {
      console.error("signUp error full:", err);
      const msg = err?.message || safeText(err);

      if (
        typeof msg === "string" &&
        msg.toLowerCase().includes("found in an online data breach")
      ) {
        Alert.alert(
          "Unsafe Password",
          "That password has been found in an online data breach. Choose a new, stronger password.",
        );
        setLoading(false);
        return;
      }

      if (err?.errors && Array.isArray(err.errors)) {
        const first = err.errors[0];
        Alert.alert("Sign up failed", first?.message || JSON.stringify(first));
        setLoading(false);
        return;
      }

      Alert.alert(
        "Sign up failed",
        typeof msg === "string" ? msg : "Unknown error (see console).",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      if (!signUp)
        return Alert.alert(
          "Auth not ready",
          "Please wait a moment and try again.",
        );
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      Alert.alert("Sent", "Verification code resent. Check your email.");
    } catch (e: any) {
      console.error("resend error", e);
      Alert.alert("Resend failed", e?.message || safeText(e));
    }
  };

  const handleVerify = async () => {
    if (!isLoaded) return Alert.alert("Please wait", "Auth not loaded yet");
    if (!code)
      return Alert.alert(
        "Missing Code",
        "Enter the code you received via email",
      );

    setLoading(true);
    try {
      if (!signUp) {
        setLoading(false);
        return Alert.alert(
          "Auth not ready",
          "Please wait a moment and try again.",
        );
      }

      const attempt = await signUp.attemptEmailAddressVerification({ code });
      console.log("attemptEmailAddressVerification result:", safeText(attempt));

      if (attempt?.status === "complete" && attempt?.createdSessionId) {
        await setActive({ session: attempt.createdSessionId });
        router.replace("/home");
        return;
      }

      if (
        attempt?.status === "missing_requirements" &&
        (attempt as any)?.missingFields?.length
      ) {
        Alert.alert(
          "Missing fields",
          `Clerk requires: ${(attempt as any).missingFields.join(", ")}`,
        );
        setStep("form");
        setLoading(false);
        return;
      }

      Alert.alert(
        "Verification not completed",
        "Verification did not return a session.",
      );
    } catch (err: any) {
      console.error("verification error:", err);
      const message = err?.message || safeText(err);
      if (
        typeof message === "string" &&
        message.toLowerCase().includes("already been verified")
      ) {
        Alert.alert(
          "Already verified",
          "Your email is already verified. Please sign in.",
        );
        router.replace("/signin");
      } else {
        Alert.alert(
          "Verification failed",
          typeof message === "string" ? message : "Unknown error.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // Verify UI
  if (step === "verify") {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <LinearGradient
          colors={["#000000", "#0d0705", "#000000"]}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Animated background orbs */}
        <Animated.View
          style={[
            styles.floatingOrb,
            {
              transform: [
                { scale: pulseAnim },
                { rotate: spin },
                { translateY: -height * 0.25 },
                { translateX: -width * 0.1 },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={["#FF6B00", "#FF8C42", "#FFA500"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.orbGradient}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.secondaryOrb,
            {
              transform: [{ scale: pulseAnim }, { rotate: spin }],
            },
          ]}
        >
          <LinearGradient
            colors={["rgba(255, 107, 0, 0.3)", "rgba(255, 140, 66, 0.2)"]}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.orbGradient}
          />
        </Animated.View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View
              style={[
                styles.contentContainer,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
                },
              ]}
            >
              <View style={styles.header}>
                <View style={styles.iconContainer}>
                  <LinearGradient
                    colors={["#FF6B00", "#FF8C42"]}
                    style={styles.iconGradient}
                  >
                    <Text style={styles.iconText}>✉</Text>
                  </LinearGradient>
                </View>
                <Text style={styles.title}>Check Your Email</Text>
                <Text style={styles.subtitle}>
                  We sent a verification code to{"\n"}
                  <Text style={styles.emailText}>{email}</Text>
                </Text>
              </View>

              <View style={styles.formContainer}>
                <View style={styles.inputWrapper}>
                  <BlurView intensity={15} tint="dark" style={styles.inputBlur}>
                    <TextInput
                      value={code}
                      onChangeText={setCode}
                      placeholder="Enter 6-digit code"
                      placeholderTextColor="rgba(255, 255, 255, 0.35)"
                      style={[
                        styles.input,
                        focusedField === "code" && styles.inputFocused,
                      ]}
                      onFocus={() => setFocusedField("code")}
                      onBlur={() => setFocusedField(null)}
                      keyboardType="number-pad"
                      autoComplete="one-time-code"
                      maxLength={6}
                      textAlign="center"
                      // letterSpacing={8}
                    />
                  </BlurView>
                  {focusedField === "code" && (
                    <View style={styles.focusIndicator} />
                  )}
                </View>

                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    loading && styles.buttonDisabled,
                  ]}
                  onPress={handleVerify}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={["#FF6B00", "#FF8C42"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.buttonGradient}
                  >
                    <Text style={styles.primaryButtonText}>
                      {loading ? "Verifying..." : "Verify Email"}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>

                <View style={styles.resendContainer}>
                  <Text style={styles.resendText}>
                    Didn't receive the code?{" "}
                  </Text>
                  <TouchableOpacity onPress={handleResend} activeOpacity={0.7}>
                    <Text style={styles.resendLink}>Resend</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.footer}>
                <TouchableOpacity
                  onPress={() => setStep("form")}
                  activeOpacity={0.7}
                >
                  <Text style={styles.backButton}>← Back to Sign Up</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // Sign-up form UI
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={["#000000", "#0d0705", "#000000"]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Animated background orbs */}
      <Animated.View
        style={[
          styles.floatingOrb,
          {
            transform: [
              { scale: pulseAnim },
              { rotate: spin },
              { translateY: -height * 0.25 },
              { translateX: -width * 0.1 },
            ],
          },
        ]}
      >
        <LinearGradient
          colors={["#FF6B00", "#FF8C42", "#FFA500"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.orbGradient}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.secondaryOrb,
          {
            transform: [{ scale: pulseAnim }, { rotate: spin }],
          },
        ]}
      >
        <LinearGradient
          colors={["rgba(255, 107, 0, 0.3)", "rgba(255, 140, 66, 0.2)"]}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.orbGradient}
        />
      </Animated.View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            style={[
              styles.contentContainer,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
              },
            ]}
          >
            <View style={styles.header}>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Join the future of fashion</Text>
            </View>

            <View style={styles.formContainer}>
              {/* Email/Password Form */}
              <View style={styles.inputsSection}>
                <View style={styles.inputWrapper}>
                  <BlurView intensity={15} tint="dark" style={styles.inputBlur}>
                    <View style={styles.inputContainer}>
                      <Text style={styles.inputIcon}>👤</Text>
                      <TextInput
                        value={username}
                        onChangeText={setUsername}
                        placeholder="Username"
                        placeholderTextColor="rgba(255, 255, 255, 0.35)"
                        autoCapitalize="none"
                        style={[
                          styles.input,
                          focusedField === "username" && styles.inputFocused,
                        ]}
                        onFocus={() => setFocusedField("username")}
                        onBlur={() => setFocusedField(null)}
                      />
                    </View>
                  </BlurView>
                  {focusedField === "username" && (
                    <View style={styles.focusIndicator} />
                  )}
                </View>

                <View style={styles.inputWrapper}>
                  <BlurView intensity={15} tint="dark" style={styles.inputBlur}>
                    <View style={styles.inputContainer}>
                      <Text style={styles.inputIcon}>✉️</Text>
                      <TextInput
                        value={email}
                        onChangeText={setEmail}
                        placeholder="Email address"
                        placeholderTextColor="rgba(255, 255, 255, 0.35)"
                        autoCapitalize="none"
                        keyboardType="email-address"
                        style={[
                          styles.input,
                          focusedField === "email" && styles.inputFocused,
                        ]}
                        onFocus={() => setFocusedField("email")}
                        onBlur={() => setFocusedField(null)}
                      />
                    </View>
                  </BlurView>
                  {focusedField === "email" && (
                    <View style={styles.focusIndicator} />
                  )}
                </View>

                <View style={styles.inputWrapper}>
                  <BlurView intensity={15} tint="dark" style={styles.inputBlur}>
                    <View style={styles.inputContainer}>
                      <Text style={styles.inputIcon}>🔒</Text>
                      <TextInput
                        value={password}
                        onChangeText={setPassword}
                        placeholder="Password"
                        placeholderTextColor="rgba(255, 255, 255, 0.35)"
                        secureTextEntry
                        style={[
                          styles.input,
                          focusedField === "password" && styles.inputFocused,
                        ]}
                        onFocus={() => setFocusedField("password")}
                        onBlur={() => setFocusedField(null)}
                      />
                    </View>
                  </BlurView>
                  {focusedField === "password" && (
                    <View style={styles.focusIndicator} />
                  )}
                </View>

                <Text style={styles.hintText}>
                  Minimum 8 characters with letters, numbers & symbols
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                onPress={handleSignUp}
                disabled={loading}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={["#FF6B00", "#FF8C42"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.buttonGradient}
                >
                  <Text style={styles.primaryButtonText}>
                    {loading ? "Creating Account..." : "Create Account"}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* OAuth Buttons - Side by Side */}
              <View style={styles.oauthSection}>
                <TouchableOpacity
                  style={styles.oauthButtonCompact}
                  onPress={() => handleOAuthSignIn("oauth_google")}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  <BlurView intensity={12} tint="dark" style={styles.oauthBlur}>
                    <View style={styles.oauthContentCompact}>
                      <GoogleIcon size={20} />
                      <Text style={styles.oauthTextCompact}>Google</Text>
                    </View>
                  </BlurView>
                </TouchableOpacity>

                {Platform.OS === "ios" && (
                  <TouchableOpacity
                    style={styles.oauthButtonCompact}
                    onPress={() => handleOAuthSignIn("oauth_apple")}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    <BlurView
                      intensity={12}
                      tint="dark"
                      style={styles.oauthBlur}
                    >
                      <View style={styles.oauthContentCompact}>
                        <AppleIcon size={20} color="#FFFFFF" />
                        <Text style={styles.oauthTextCompact}>Apple</Text>
                      </View>
                    </BlurView>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <Link href="/signin" asChild>
                <TouchableOpacity activeOpacity={0.7}>
                  <Text style={styles.linkText}>Sign In</Text>
                </TouchableOpacity>
              </Link>
            </View>

            <Text style={styles.termsText}>
              By creating an account, you agree to our{"\n"}
              <Text style={styles.termsLink}>Terms of Service</Text>
              {" & "}
              <Text style={styles.termsLink}>Privacy Policy</Text>
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  floatingOrb: {
    position: "absolute",
    width: width * 1.8,
    height: width * 1.8,
    borderRadius: width * 0.9,
    top: -width * 0.6,
    left: -width * 0.4,
    opacity: 0.12,
  },
  secondaryOrb: {
    position: "absolute",
    width: width * 1.2,
    height: width * 1.2,
    borderRadius: width * 0.6,
    bottom: -width * 0.4,
    right: -width * 0.3,
    opacity: 0.08,
  },
  orbGradient: {
    flex: 1,
    borderRadius: width * 0.9,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  contentContainer: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
  },
  header: {
    marginBottom: 40,
    alignItems: "center",
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    marginBottom: 24,
    overflow: "hidden",
    shadowColor: "#FF6B00",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  iconGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  iconText: {
    fontSize: 36,
    color: "#FFFFFF",
  },
  title: {
    fontSize: 36,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 12,
    letterSpacing: -0.5,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.55)",
    lineHeight: 24,
    fontWeight: "400",
    textAlign: "center",
  },
  emailText: {
    color: "#FF8C42",
    fontWeight: "600",
  },
  formContainer: {
    marginBottom: 28,
  },
  oauthSection: {
    flexDirection: "row",
    gap: 10,
  },
  oauthButton: {
    height: 54,
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 10,
  },
  oauthButtonCompact: {
    flex: 1,
    height: 54,
    borderRadius: 14,
    overflow: "hidden",
  },
  oauthBlur: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  oauthContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  oauthContentCompact: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  oauthText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  oauthTextCompact: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  dividerText: {
    color: "rgba(255, 255, 255, 0.35)",
    paddingHorizontal: 16,
    fontSize: 12,
    fontWeight: "500",
  },
  inputsSection: {
    marginBottom: 24,
  },
  inputWrapper: {
    marginBottom: 12,
    position: "relative",
  },
  inputBlur: {
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  inputIcon: {
    fontSize: 18,
    marginRight: 12,
    opacity: 0.6,
  },
  input: {
    flex: 1,
    height: 54,
    fontSize: 15,
    color: "#FFFFFF",
    fontWeight: "500",
  },
  inputFocused: {
    borderColor: "transparent",
  },
  focusIndicator: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#FF6B00",
    pointerEvents: "none",
  },
  hintText: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.35)",
    marginTop: 8,
    lineHeight: 16,
    paddingHorizontal: 4,
  },
  primaryButton: {
    height: 54,
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#FF6B00",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  resendContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
  },
  resendText: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.5)",
  },
  resendLink: {
    fontSize: 14,
    color: "#FF6B00",
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  footerText: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.5)",
  },
  linkText: {
    fontSize: 14,
    color: "#FF6B00",
    fontWeight: "600",
  },
  backButton: {
    fontSize: 14,
    color: "#FF6B00",
    fontWeight: "600",
  },
  termsText: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.35)",
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  termsLink: {
    color: "#FF8C42",
    fontWeight: "500",
  },
});