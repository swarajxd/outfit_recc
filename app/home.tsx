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
  const [currentStage, setCurrentStage] = useState<number>(0); // 0 = no stage, 1 = upload, 2 = analyzing, 3 = complete
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const imageScaleAnim = useRef(new Animated.Value(0)).current;

  // Get default URL based on platform
  const getDefaultApiUrl = () => {
    const computerIP = '192.168.1.104'; // Updated to correct IP
    
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
      quality: 0.4, // VERY LOW quality for fastest upload possible
      aspect: [3, 4],
      // Resize to max 1024px width to reduce file size
      allowsMultipleSelection: false,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
      setCurrentStage(1); // Stage 1: Image uploaded
      
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
    setResultMessage('🔄 Testing connection...');
    
    try {
      // Use XMLHttpRequest for better error handling
      const testResult = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', `${API_BASE_URL}/health`);
        xhr.timeout = 5000; // 5 second timeout
        
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              resolve({ success: true, data });
            } catch (e) {
              resolve({ success: true, data: { status: 'ok' } });
            }
          } else {
            reject(new Error(`Server returned status ${xhr.status}`));
          }
        };
        
        xhr.onerror = () => {
          reject(new Error(`Cannot connect to ${API_BASE_URL}`));
        };
        
        xhr.ontimeout = () => {
          reject(new Error(`Connection timeout - server not responding`));
        };
        
        xhr.send();
      });
      
      // Success!
      Alert.alert(
        '✅ Connection Successful', 
        `Successfully connected to:\n${API_BASE_URL}\n\nServer is running and ready!`,
        [{ text: 'OK', onPress: () => setShowApiConfig(false) }]
      );
      setResultMessage(null);
    } catch (err: any) {
      const errorMsg = err?.message || 'Unknown error';
      console.error('Connection test error:', errorMsg);
      
      Alert.alert(
        '❌ Connection Failed',
        `Cannot reach API server at:\n${API_BASE_URL}\n\n` +
        `Error: ${errorMsg}\n\n` +
        `Troubleshooting Steps:\n\n` +
        `1. Make sure FastAPI server is running:\n` +
        `   Open terminal and run:\n` +
        `   cd e:\\fitsenseapp\\outfit_recc\\aiwork\n` +
        `   python api.py\n\n` +
        `2. Wait for this message in terminal:\n` +
        `   "📱 Mobile app should connect to: http://192.168.1.102:8000"\n\n` +
        `3. Keep the terminal window OPEN\n\n` +
        `4. Check your API URL matches the server IP\n\n` +
        `5. Ensure device & computer are on same WiFi\n\n` +
        `6. Check Windows Firewall allows port 8000`,
        [{ text: 'OK' }]
      );
      setResultMessage(`❌ Connection failed: ${errorMsg}`);
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
    setCurrentStage(2); // Stage 2: AI Analysis in progress

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

      // NEW APPROACH: Upload immediately, then poll for results (no timeout issues!)
      setResultMessage('🔄 Uploading image... Processing will start shortly.');

      // Step 1: Upload with MANUAL timeout (React Native's timeout doesn't work)
      const uploadData = await Promise.race([
        new Promise<any>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', `${API_BASE_URL}/upload-outfit`);
          
          let uploadStartTime = Date.now();
          let lastProgressTime = Date.now();
          
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const data = JSON.parse(xhr.responseText);
                resolve(data);
              } catch (e) {
                reject(new Error('Failed to parse upload response'));
              }
            } else {
              try {
                const errorData = JSON.parse(xhr.responseText);
                reject(new Error(errorData.error || `Server error: ${xhr.status}`));
              } catch {
                reject(new Error(`Server error: ${xhr.status}`));
              }
            }
          };
          
          xhr.onerror = () => {
            const errorMsg = `Upload failed. Server at ${API_BASE_URL} is not responding.\n\n` +
              `Possible issues:\n` +
              `1. Server is not running - Run: cd aiwork && python api.py\n` +
              `2. Wrong IP address - Check your computer's IP\n` +
              `3. Firewall blocking connection - Check Windows Firewall\n` +
              `4. Device and computer not on same WiFi`;
            reject(new Error(errorMsg));
          };
          
          // Show upload progress and check for stall
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const percentComplete = (e.loaded / e.total) * 100;
              const elapsed = (Date.now() - uploadStartTime) / 1000;
              setResultMessage(`🔄 Uploading image... ${Math.round(percentComplete)}% (${Math.round(elapsed)}s)`);
              lastProgressTime = Date.now();
            }
          };
          
          // Check every 5 seconds if upload is stalled
          const progressCheckInterval = setInterval(() => {
            const timeSinceLastProgress = Date.now() - lastProgressTime;
            const totalElapsed = Date.now() - uploadStartTime;
            
            // If no progress for 30 seconds, abort
            if (timeSinceLastProgress > 30000) {
              clearInterval(progressCheckInterval);
              xhr.abort();
              reject(new Error('Upload stalled. Network may be too slow. Try a smaller image or better WiFi.'));
            }
          }, 5000);
          
          xhr.onloadend = () => clearInterval(progressCheckInterval);
          
          xhr.send(formData as any);
        }),
        // Manual timeout: 2 minutes max for upload
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error('Upload timeout after 2 minutes. Image may be too large or network too slow.'));
          }, 120000); // 2 minutes
        })
      ]);
      
      if (!uploadData.success || !uploadData.job_id) {
        throw new Error('Failed to start processing');
      }

      const jobId = uploadData.job_id;
      setResultMessage('🔄 Processing image through AI pipeline...\n\nThis may take 1-3 minutes. Please wait...');

      // Step 2: Poll for results (quick requests, no long timeout)
      let attempts = 0;
      const maxAttempts = 300; // 5 minutes max (1 second intervals) - AI can take time
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        
        // Use XMLHttpRequest for polling too (no timeout issues)
        const statusData = await new Promise<any>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('GET', `${API_BASE_URL}/job/${jobId}`);
          xhr.timeout = 10000; // 10 seconds for status check (should be instant)
          
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                resolve(JSON.parse(xhr.responseText));
              } catch (e) {
                reject(new Error('Failed to parse status response'));
              }
            } else {
              reject(new Error(`Failed to check job status: ${xhr.status}`));
            }
          };
          
          xhr.onerror = () => reject(new Error('Network error checking status'));
          xhr.ontimeout = () => reject(new Error('Status check timed out'));
          
          xhr.send();
        });
        
        if (statusData.status === 'completed') {
          // Success!
          const results = statusData.results;
          setResults(results);
          setCurrentStage(3); // Stage 3: Complete
          
          const detections = results.detections || {};
          const itemsCount = results.items_classified || 0;
          
          const detectionSummary = Object.entries(detections)
            .filter(([_, count]: [string, any]) => count > 0)
            .map(([item, count]: [string, any]) => `${item}: ${count}`)
            .join(', ');
          
          setResultMessage(
            `✅ Success! Detected ${itemsCount} clothing items. ${detectionSummary ? `(${detectionSummary})` : ''}`
          );
          return; // Exit successfully
        } else if (statusData.status === 'error') {
          throw new Error(statusData.error || 'Processing failed');
        }
        
        // Still processing, continue polling
        attempts++;
      }
      
      // Timeout after max attempts
      throw new Error('Processing is taking longer than expected. Please try again.');
    } catch (err: any) {
      console.error('Pipeline error:', err);
      
      let errorMessage = '';
      
      if (err.name === 'AbortError' || err.message.includes('timeout') || err.message.includes('timed out')) {
        errorMessage = '⏱️ Processing is taking longer than expected.\n\n' +
          'The AI pipeline (YOLO + Segmentation) can take 3-5 minutes for high-quality images.\n\n' +
          'Please try again, or check if the server is still processing your image.';
      } else if (err.message.includes('Network request failed') || err.message.includes('fetch') || err.message.includes('Failed to fetch')) {
        errorMessage = `❌ Cannot connect to API server.\n\n` +
          `Troubleshooting:\n` +
          `1. Make sure server is running: cd aiwork && python api.py\n` +
          `2. Check API URL: ${API_BASE_URL}\n` +
          `3. Ensure device & computer are on same WiFi\n` +
          `4. Try the "Test Connection" button in settings`;
      } else if (err.message.includes('aborted') || err.message.includes('Abort')) {
        errorMessage = 'Request was cancelled. Please try again.';
      } else {
        errorMessage = `Error: ${err?.message || 'Unknown error occurred'}\n\n` +
          `Make sure the API server is running and try again.`;
      }
      
      setResultMessage(errorMessage);
      setCurrentStage(1); // Reset to stage 1 on error
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
                  ? '• Emulator: http://10.0.2.2:8000\n• Physical Device: http://192.168.1.104:8000'
                  : '• Simulator: http://localhost:8000\n• Physical Device: http://192.168.1.104:8000'}
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
                disabled={uploading || !imageUri}
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

            {/* View Wardrobe Button - Show when stage 3 is complete */}
            {currentStage >= 3 && results && (
              <TouchableOpacity
                style={styles.wardrobeButton}
                onPress={() => router.push('/wardrobe')}
                activeOpacity={0.9}
              >
                <Text style={styles.wardrobeButtonText}>View Digital Wardrobe →</Text>
              </TouchableOpacity>
            )}

            {/* Steps with Progress */}
            <View style={styles.stepsContainer}>
              <View style={styles.stepItem}>
                <View style={[
                  styles.stepCircle, 
                  currentStage >= 1 ? styles.stepCircleActive : styles.stepCircleInactive
                ]}>
                  <Text style={styles.stepNumber}>1</Text>
                </View>
                <View style={[
                  styles.stepLine,
                  currentStage >= 2 ? styles.stepLineActive : styles.stepLineInactive
                ]} />
              </View>
              <View style={styles.stepItem}>
                <View style={[
                  styles.stepCircle,
                  currentStage >= 2 ? styles.stepCircleActive : styles.stepCircleInactive
                ]}>
                  <Text style={styles.stepNumber}>2</Text>
                </View>
                <View style={[
                  styles.stepLine,
                  currentStage >= 3 ? styles.stepLineActive : styles.stepLineInactive
                ]} />
              </View>
              <View style={styles.stepItem}>
                <View style={[
                  styles.stepCircle,
                  currentStage >= 3 ? styles.stepCircleActive : styles.stepCircleInactive
                ]}>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: {
    backgroundColor: '#FF8C00',
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
    marginHorizontal: 4,
  },
  stepLineActive: {
    backgroundColor: '#FF8C00',
  },
  stepLineInactive: {
    backgroundColor: '#4a4a4a',
  },
  wardrobeButton: {
    width: '100%',
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#2a2a2a',
    borderWidth: 2,
    borderColor: '#FF8C00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wardrobeButtonText: {
    color: '#FF8C00',
    fontWeight: '700',
    fontSize: 16,
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