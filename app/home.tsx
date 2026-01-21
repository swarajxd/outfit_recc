// app/home.tsx
import React, { useState, useRef, useEffect } from 'react';
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
  Animated,
  ScrollView,
  Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useUser, useClerk } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

export default function Home() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [results, setResults] = useState<any>(null);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const imageScaleAnim = useRef(new Animated.Value(0)).current;

  // Get default URL based on platform
  const getDefaultApiUrl = () => {
    const computerIP = '192.168.1.102';
    
    if (Platform.OS === 'android') {
      return `http://${computerIP}:8000`;
    } else if (Platform.OS === 'ios') {
      return `http://${computerIP}:8000`;
    }
    return `http://${computerIP}:8000`;
  };
  
  const [apiUrl, setApiUrl] = useState<string>(() => getDefaultApiUrl());
  const [showApiConfig, setShowApiConfig] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  const API_BASE_URL = apiUrl || getDefaultApiUrl();

  // Entrance animations
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 40,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

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
      
      // Animate image appearance
      imageScaleAnim.setValue(0);
      Animated.spring(imageScaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }).start();
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
      const formData = new FormData();
      
      const filename = imageUri.split('/').pop() || 'outfit-photo.jpg';
      const fileType = filename.split('.').pop() || 'jpg';
      
      formData.append('file', {
        uri: imageUri,
        type: `image/${fileType}`,
        name: filename,
      } as any);
      
      const userId = user?.id || user?.emailAddresses?.[0]?.emailAddress || 'default_user';
      formData.append('user_id', userId);

      console.log(`Uploading to: ${API_BASE_URL}/upload-outfit`);
      console.log(`User ID: ${userId}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      const response = await fetch(`${API_BASE_URL}/upload-outfit`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
        headers: {},
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
        {/* Back Button */}
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => setShowApiConfig(!showApiConfig)}
          activeOpacity={0.7}
        >
          <Text style={styles.backButtonText}>{'<'}</Text>
        </TouchableOpacity>

        {/* API Config Modal */}
        {showApiConfig && (
          <Animated.View style={[styles.apiConfigModal, { opacity: fadeAnim }]}>
            <View style={styles.apiConfigCard}>
              <Text style={styles.apiConfigTitle}>⚙️ API Configuration</Text>
              <Text style={styles.apiConfigHint}>
                {Platform.OS === 'android' 
                  ? '• Emulator: http://10.0.2.2:8000\n• Physical Device: http://192.168.1.102:8000'
                  : '• Simulator: http://localhost:8000\n• Physical Device: http://192.168.1.102:8000'}
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
                  activeOpacity={0.8}
                >
                  {testingConnection ? (
                    <ActivityIndicator color="#FF8C00" size="small" />
                  ) : (
                    <Text style={styles.testButtonText}>Test</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.closeButton} 
                  onPress={() => setShowApiConfig(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.closeButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        )}

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View 
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            {/* Title */}
            <Text style={styles.title}>
              Upload your <Text style={styles.titleHighlight}>look</Text>
            </Text>
            <Text style={styles.description}>
              Capture your style and let AI analyze your outfit with advanced YOLO detection
            </Text>

            {/* Image Preview */}
            <Animated.View 
              style={[
                styles.imageContainer,
                imageUri && { transform: [{ scale: imageScaleAnim }] }
              ]}
            >
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.previewImage} />
              ) : (
                <View style={styles.placeholderContainer}>
                  <View style={styles.placeholder} />
                </View>
              )}
            </Animated.View>

            {/* Action Buttons */}
            <View style={styles.buttonsRow}>
              <TouchableOpacity 
                style={styles.addButton} 
                onPress={pickImage} 
                disabled={uploading}
                activeOpacity={0.8}
              >
                <Text style={styles.addButtonText}>Add Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.analyzeButton, uploading && { opacity: 0.7 }]}
                onPress={handleRunPipeline}
                disabled={uploading}
                activeOpacity={0.9}
              >
                {uploading ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color="#000" size="small" />
                    <Text style={styles.analyzeButtonText}>Analyzing...</Text>
                  </View>
                ) : (
                  <Text style={styles.analyzeButtonText}>Analyze Style</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Steps */}
            <View style={styles.stepsContainer}>
              <View style={styles.stepItem}>
                <View style={styles.stepCircle}>
                  <Text style={styles.stepNumber}>1</Text>
                </View>
                <View style={styles.stepLine} />
              </View>
              <View style={styles.stepItem}>
                <View style={styles.stepCircle}>
                  <Text style={styles.stepNumber}>2</Text>
                </View>
                <View style={styles.stepLine} />
              </View>
              <View style={styles.stepItem}>
                <View style={[styles.stepCircle, styles.stepCircleInactive]}>
                  <Text style={styles.stepNumber}>3</Text>
                </View>
              </View>
            </View>

            <View style={styles.stepLabelsContainer}>
              <View style={styles.stepLabel}>
                <Text style={styles.stepLabelText}>Upload clear full-</Text>
                <Text style={styles.stepLabelText}>body photo</Text>
              </View>
              <View style={styles.stepLabel}>
                <Text style={styles.stepLabelText}>AI detection</Text>
              </View>
              <View style={styles.stepLabel}>
                <Text style={styles.stepLabelText}>Clothings added</Text>
                <Text style={styles.stepLabelText}>to closet</Text>
              </View>
            </View>

            {/* Result Message */}
            {resultMessage && (
              <Animated.View style={[styles.resultBanner, { opacity: fadeAnim }]}>
                <Text style={styles.resultText}>{resultMessage}</Text>
              </Animated.View>
            )}

            {/* Results */}
            {results && results.items && results.items.length > 0 && (
              <Animated.View style={[styles.resultsContainer, { opacity: fadeAnim }]}>
                <Text style={styles.resultsTitle}>🎯 Detected Items</Text>
                {results.items.slice(0, 5).map((item: any, index: number) => (
                  <View key={index} style={styles.resultItem}>
                    <View style={styles.resultDot} />
                    <Text style={styles.resultItemText}>
                      {item.category} • {item.attributes?.color?.color || 'N/A'} • {item.attributes?.pattern?.pattern || 'solid'}
                    </Text>
                  </View>
                ))}
                {results.items.length > 5 && (
                  <Text style={styles.moreItemsText}>
                    +{results.items.length - 5} more items detected
                  </Text>
                )}
              </Animated.View>
            )}
          </Animated.View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 100,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
  },
  apiConfigModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    zIndex: 99,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  apiConfigCard: {
    width: '100%',
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  apiConfigTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  apiConfigHint: {
    color: '#9ca3af',
    fontSize: 12,
    marginBottom: 16,
    lineHeight: 18,
  },
  apiInput: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#3a3a3a',
    borderRadius: 12,
    padding: 14,
    color: '#e5e7eb',
    fontSize: 14,
    marginBottom: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  apiConfigButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  testButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FF8C00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  testButtonText: {
    color: '#000000',
    fontWeight: '700',
    fontSize: 14,
  },
  closeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#3a3a3a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: '#9ca3af',
    fontWeight: '600',
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 100,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    marginTop: -20,
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  titleHighlight: {
    color: '#FF8C00',
    fontWeight: '600',
  },
  description: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  imageContainer: {
    width: width - 80,
    height: height * 0.4,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 30,
    backgroundColor: '#2a2a2a',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    width: '90%',
    height: '90%',
    borderRadius: 16,
    backgroundColor: '#3a3a3a',
  },
  buttonsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
    marginBottom: 40,
    paddingHorizontal: 10,
  },
  addButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
  analyzeButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#FF8C00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyzeButtonText: {
    color: '#000000',
    fontWeight: '700',
    fontSize: 15,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    paddingHorizontal: 10,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF8C00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleInactive: {
    backgroundColor: '#4a4a4a',
  },
  stepNumber: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
  stepLine: {
    width: 60,
    height: 2,
    backgroundColor: '#4a4a4a',
    marginHorizontal: 4,
  },
  stepLabelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 10,
    marginBottom: 30,
  },
  stepLabel: {
    flex: 1,
    alignItems: 'center',
  },
  stepLabelText: {
    color: '#9ca3af',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 14,
  },
  resultBanner: {
    width: '100%',
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  resultText: {
    color: '#e5e7eb',
    fontSize: 13,
    lineHeight: 20,
  },
  resultsContainer: {
    width: '100%',
    marginTop: 20,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  resultsTitle: {
    color: '#FF8C00',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF8C00',
    marginRight: 12,
  },
  resultItemText: {
    color: '#e5e7eb',
    fontSize: 14,
    flex: 1,
  },
  moreItemsText: {
    color: '#9ca3af',
    fontSize: 13,
    marginTop: 8,
    fontStyle: 'italic',
  },
});