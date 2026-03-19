import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Get the server base URL based on the current platform.
 * - Android Emulator: 10.0.2.2
 * - iOS Simulator / Web / Others: localhost
 */
export const getServerBase = (): string => {
  // Use env var if available (highest priority)
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (envUrl) return envUrl;

  // Use Constants.expoConfig.extra if available
  const extraUrl = (Constants.expoConfig?.extra as any)?.API_BASE_URL;
  
  // If we have a hardcoded 10.0.2.2 from config but we're on web, fix it
  if (Platform.OS === 'web' && extraUrl?.includes('10.0.2.2')) {
    return 'http://localhost:4000';
  }

  if (extraUrl) return extraUrl;

  // Final fallbacks
  return Platform.select({
    android: 'http://10.0.2.2:4000',
    ios: 'http://localhost:4000',
    default: 'http://localhost:4000',
  });
};

export const SERVER_BASE = getServerBase();
