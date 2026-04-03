import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * Get the server base URL based on the current platform.
 * - Android Emulator: 10.0.2.2
 * - iOS Simulator / Web / Others: localhost
 */
export const getServerBase = (): string => {
  // Use Platform.select to return the correct URL based on platform
  const platformUrl = Platform.select({
    web: "http://localhost:4000",
    android: "http://10.0.2.2:4000",
    ios: "http://localhost:4000",
    default: "http://localhost:4000",
  });

  // If we're on web, return the localhost URL immediately for safe same-machine dev
  if (Platform.OS === ("web" as any)) {
    return platformUrl;
  }

  // Use env var if available (highest priority for native)
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (envUrl) return envUrl;

  // Use Constants.expoConfig.extra if available
  const extraUrl = (Constants.expoConfig?.extra as any)?.API_BASE_URL;
  if (extraUrl) return extraUrl;

  return platformUrl;
};

export const SERVER_BASE = getServerBase();
