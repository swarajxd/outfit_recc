// app/home.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  TextInput,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useUser, useClerk } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';

export default function Home() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [results, setResults] = useState<any>(null);
  
  // Get default URL based on platform
  const getDefaultApiUrl = () => {
    // Using your computer's IP address works for both simulators and physical devices
    // If you're on iOS simulator and want to use localhost, you can change it in settings
    const computerIP = '192.168.1.102'; // Your computer's local IP address
    
    if (Platform.OS === 'android') {
      // Android emulator: 10.0.2.2 maps to host machine's localhost
      // Physical Android device: Use your computer's IP
      // Try IP first - works for both emulator and physical device
      return `http://${computerIP}:8000`;
    } else if (Platform.OS === 'ios') {
      // iOS: Use IP address - works for both simulator and physical device
      // If localhost doesn't work, the IP will
      return `http://${computerIP}:8000`;
    }
    // Default fallback - use your computer's IP
    return `http://${computerIP}:8000`;
  };
  
  // Initialize with the correct URL immediately (no useEffect delay)
  const [apiUrl, setApiUrl] = useState<string>(() => getDefaultApiUrl());
  const [showApiConfig, setShowApiConfig] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  const API_BASE_URL = apiUrl || getDefaultApiUrl();

  const pickImage = async () => {
    setResultMessage(null);

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setResultMessage('Permission to access photos was denied.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.9,
      aspect: [3, 4],
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
    }
  };

  const testConnection = async () => {
    setTestingConnection(true);
    try {
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        Alert.alert('✅ Connection Successful', `Connected to: ${API_BASE_URL}`);
        setShowApiConfig(false);
      } else {
        throw new Error('Server responded with error');
      }
    } catch (err: any) {
      Alert.alert(
        '❌ Connection Failed',
        `Cannot reach API server at ${API_BASE_URL}\n\n` +
        `Troubleshooting:\n` +
        `1. Make sure FastAPI server is running:\n` +
        `   cd aiwork && python api.py\n\n` +
        `2. Check your API URL:\n` +
        `   • Android Emulator: http://10.0.2.2:8000\n` +
        `   • iOS Simulator: http://localhost:8000\n` +
        `   • Physical Device: http://192.168.1.102:8000\n\n` +
        `3. Ensure device & computer are on the same WiFi\n\n` +
        `4. Check Windows Firewall allows port 8000`
      );
    } finally {
      setTestingConnection(false);
    }
  };

  const handleRunPipeline = async () => {
    if (!imageUri) {
      setResultMessage('Please add a photo first.');
      return;
    }

    if (!apiUrl) {
      Alert.alert(
        'API URL Required',
        'Please configure the API server URL first. Click the settings icon in the header.',
        [{ text: 'OK', onPress: () => setShowApiConfig(true) }]
      );
      return;
    }

    setUploading(true);
    setResultMessage(null);
    setResults(null);

    try {
      // Create FormData for multipart/form-data upload
      const formData = new FormData();
      
      // Extract filename from URI (or use a default)
      const filename = imageUri.split('/').pop() || 'outfit-photo.jpg';
      const fileType = filename.split('.').pop() || 'jpg';
      
      formData.append('file', {
        uri: imageUri,
        type: `image/${fileType}`,
        name: filename,
      } as any);
      
      // Use Clerk user ID or fallback to email/username
      const userId = user?.id || user?.emailAddresses?.[0]?.emailAddress || 'default_user';
      formData.append('user_id', userId);

      console.log(`Uploading to: ${API_BASE_URL}/upload-outfit`);
      console.log(`User ID: ${userId}`);

      // Call the FastAPI endpoint with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

      const response = await fetch(`${API_BASE_URL}/upload-outfit`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
        headers: {
          // Don't set Content-Type - let React Native set it with boundary
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setResults(data.results);
        const detections = data.results.detections || {};
        const itemsCount = data.results.items_classified || 0;
        
        const detectionSummary = Object.entries(detections)
          .filter(([_, count]: [string, any]) => count > 0)
          .map(([item, count]: [string, any]) => `${item}: ${count}`)
          .join(', ');
        
        setResultMessage(
          `✅ Success! Detected ${itemsCount} clothing items. ${detectionSummary ? `(${detectionSummary})` : ''}`
        );
      } else {
        throw new Error(data.error || 'Processing failed');
      }
    } catch (err: any) {
      console.error('Pipeline error:', err);
      
      let errorMessage = 'Failed to process image. ';
      
      if (err.name === 'AbortError' || err.message.includes('timeout')) {
        errorMessage += 'Request timed out. The image might be too large or processing is taking too long.';
      } else if (err.message.includes('Network request failed') || err.message.includes('fetch')) {
        errorMessage += `Cannot connect to API server at ${API_BASE_URL}.\n\n` +
          `Quick Fix:\n` +
          `1. Start server: cd aiwork && python api.py\n` +
          `2. Use correct URL:\n` +
          `   • Physical device: http://192.168.1.102:8000\n` +
          `   • Emulator/Simulator: Check settings\n` +
          `3. Same WiFi network required`;
      } else {
        errorMessage += err?.message || 'Make sure the API server is running.';
      }
      
      setResultMessage(`❌ ${errorMessage}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/signin');
    } catch (err) {
      console.error('signOut error', err);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.welcomeText}>Hey{user?.firstName ? `, ${user.firstName}` : ''}</Text>
            <Text style={styles.subtitle}>Let&apos;s get your outfit analyzed.</Text>
            {apiUrl && (
              <Text style={styles.apiUrlText}>API: {apiUrl}</Text>
            )}
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity style={styles.settingsButton} onPress={() => setShowApiConfig(!showApiConfig)}>
              <Text style={styles.settingsButtonText}>⚙️</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.signOutChip} onPress={handleSignOut}>
              <Text style={styles.signOutText}>Sign out</Text>
            </TouchableOpacity>
          </View>
        </View>

        {showApiConfig && (
          <View style={styles.apiConfigCard}>
            <Text style={styles.apiConfigTitle}>Configure API Server</Text>
            <Text style={styles.apiConfigHint}>
              {Platform.OS === 'android' 
                ? '• Emulator: http://10.0.2.2:8000\n• Physical Device: http://192.168.1.102:8000\n\nMake sure your device and computer are on the same WiFi network!'
                : '• Simulator: http://localhost:8000\n• Physical Device: http://192.168.1.102:8000\n\nMake sure your device and computer are on the same WiFi network!'}
            </Text>
            <TextInput
              style={styles.apiInput}
              value={apiUrl}
              onChangeText={setApiUrl}
              placeholder="http://10.0.2.2:8000"
              placeholderTextColor="#6b7280"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.apiConfigButtons}>
              <TouchableOpacity 
                style={styles.testButton} 
                onPress={testConnection}
                disabled={testingConnection || !apiUrl}
              >
                {testingConnection ? (
                  <ActivityIndicator color="#f97316" size="small" />
                ) : (
                  <Text style={styles.testButtonText}>Test Connection</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.closeButton} 
                onPress={() => setShowApiConfig(false)}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Upload your look</Text>
          <Text style={styles.heroDescription}>
            Add a clear photo of yourself and we&apos;ll send it through YOLO detection and segmentation to power your
            personalized outfit recommendations.
          </Text>

          <View style={styles.previewWrapper}>
            <View style={styles.previewCircle}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.previewImage} />
              ) : (
                <View style={styles.previewPlaceholder}>
                  <Text style={styles.previewPlaceholderIcon}>📸</Text>
                  <Text style={styles.previewPlaceholderText}>Your photo will appear here</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.secondaryButton} onPress={pickImage} disabled={uploading}>
              <Text style={styles.secondaryButtonText}>{imageUri ? 'Change photo' : 'Add a photo'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryButton, uploading && { opacity: 0.8 }]}
              onPress={handleRunPipeline}
              disabled={uploading}
            >
              {uploading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#000" size="small" />
                  <Text style={styles.primaryButtonText}>Analyzing...</Text>
                </View>
              ) : (
                <Text style={styles.primaryButtonText}>Run AI pipeline</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.stepsRow}>
            <View style={styles.stepPill}>
              <Text style={styles.stepNumber}>1</Text>
              <Text style={styles.stepText}>Upload a clear full-body photo.</Text>
            </View>
            <View style={styles.stepPill}>
              <Text style={styles.stepNumber}>2</Text>
              <Text style={styles.stepText}>We detect your pose and segment clothing.</Text>
            </View>
            <View style={styles.stepPill}>
              <Text style={styles.stepNumber}>3</Text>
              <Text style={styles.stepText}>You get smart outfit recommendations.</Text>
            </View>
          </View>

          {resultMessage && (
            <View style={styles.resultBanner}>
              <Text style={styles.resultText}>{resultMessage}</Text>
            </View>
          )}

          {results && results.items && results.items.length > 0 && (
            <View style={styles.resultsContainer}>
              <Text style={styles.resultsTitle}>Detected Items:</Text>
              {results.items.slice(0, 5).map((item: any, index: number) => (
                <View key={index} style={styles.resultItem}>
                  <Text style={styles.resultItemText}>
                    • {item.category} ({item.attributes?.color?.color || 'N/A'}, {item.attributes?.pattern?.pattern || 'solid'})
                  </Text>
                </View>
              ))}
              {results.items.length > 5 && (
                <Text style={styles.moreItemsText}>+ {results.items.length - 5} more items</Text>
              )}
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#050509',
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    backgroundColor: '#050509',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  welcomeText: {
    color: '#f97316',
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: '#e5e7eb',
    fontSize: 14,
    marginTop: 4,
  },
  apiUrlText: {
    color: '#6b7280',
    fontSize: 10,
    marginTop: 2,
    fontFamily: 'monospace',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  settingsButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#f97316',
    backgroundColor: '#111827',
  },
  settingsButtonText: {
    fontSize: 16,
  },
  signOutChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#f97316',
    backgroundColor: '#111827',
  },
  signOutText: {
    color: '#f97316',
    fontSize: 12,
    fontWeight: '600',
  },
  heroCard: {
    flex: 1,
    backgroundColor: '#020617',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1f2937',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 10,
  },
  heroTitle: {
    color: '#f9fafb',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
  },
  heroDescription: {
    color: '#9ca3af',
    fontSize: 13,
    marginBottom: 20,
  },
  previewWrapper: {
    alignItems: 'center',
    marginBottom: 20,
  },
  previewCircle: {
    width: 200,
    height: 260,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#f97316',
    backgroundColor: '#020617',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  previewPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  previewPlaceholderIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  previewPlaceholderText: {
    color: '#6b7280',
    fontSize: 13,
    textAlign: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  secondaryButton: {
    flex: 1,
    marginRight: 10,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#f97316',
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#f97316',
    fontWeight: '600',
    fontSize: 14,
  },
  primaryButton: {
    flex: 1.2,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 14,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepsRow: {
    marginTop: 4,
    marginBottom: 16,
  },
  stepPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#0b1120',
    marginBottom: 6,
  },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: '#f97316',
    textAlign: 'center',
    textAlignVertical: 'center',
    color: '#000',
    fontWeight: '800',
    fontSize: 12,
    marginRight: 8,
  },
  stepText: {
    color: '#e5e7eb',
    fontSize: 12,
    flexShrink: 1,
  },
  resultBanner: {
    marginTop: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#f97316',
  },
  resultText: {
    color: '#fde68a',
    fontSize: 13,
  },
  resultsContainer: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  resultsTitle: {
    color: '#f97316',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  resultItem: {
    marginBottom: 8,
  },
  resultItemText: {
    color: '#e5e7eb',
    fontSize: 13,
  },
  moreItemsText: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  apiConfigCard: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#f97316',
  },
  apiConfigTitle: {
    color: '#f97316',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  apiConfigHint: {
    color: '#9ca3af',
    fontSize: 11,
    marginBottom: 12,
    lineHeight: 16,
  },
  apiInput: {
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 8,
    padding: 12,
    color: '#e5e7eb',
    fontSize: 14,
    marginBottom: 12,
    fontFamily: 'monospace',
  },
  apiConfigButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  testButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f97316',
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  testButtonText: {
    color: '#f97316',
    fontWeight: '600',
    fontSize: 14,
  },
  closeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#6b7280',
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: '#9ca3af',
    fontWeight: '600',
    fontSize: 14,
  },
});
