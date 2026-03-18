// app/utils/cache.ts
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Create a custom token cache for Clerk
// This securely stores auth tokens using expo-secure-store
const createTokenCache = () => {
    return {
        async getToken(key: string) {
            try {
                const item = await SecureStore.getItemAsync(key);
                if (item) {
                    console.log(`Retrieved token for key: ${key}`);
                }
                return item;
            } catch (error) {
                console.error('SecureStore get item error:', error);
                await SecureStore.deleteItemAsync(key);
                return null;
            }
        },
        async saveToken(key: string, value: string) {
            try {
                await SecureStore.setItemAsync(key, value);
            } catch (err) {
                console.error('SecureStore save item error:', err);
            }
        },
    };
};

// Token cache only works on native platforms
export const tokenCache = Platform.OS !== 'web' ? createTokenCache() : undefined;