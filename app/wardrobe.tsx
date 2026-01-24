// app/wardrobe.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  Dimensions,
  Animated,
  FlatList,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');
const ITEM_SIZE = (width - 60) / 2; // 2 columns with padding

export default function Wardrobe() {
  const { user } = useUser();
  const router = useRouter();
  const [wardrobeItems, setWardrobeItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiUrl, setApiUrl] = useState('http://192.168.1.104:8000');

  // Get default API URL
  const getDefaultApiUrl = () => {
    return 'http://192.168.1.104:8000';
  };

  useEffect(() => {
    const defaultUrl = getDefaultApiUrl();
    setApiUrl(defaultUrl);
    fetchWardrobe();
  }, [user]);

  const fetchWardrobe = async () => {
    setLoading(true);
    try {
      const userId = user?.id || user?.emailAddresses?.[0]?.emailAddress || 'default_user';
      
      // Use XMLHttpRequest to avoid timeout issues
      const data = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', `${apiUrl}/wardrobe/${userId}`);
        xhr.timeout = 10000; // 10 second timeout
        
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch (e) {
              reject(new Error('Failed to parse wardrobe response'));
            }
          } else {
            reject(new Error(`Server error: ${xhr.status}`));
          }
        };
        
        xhr.onerror = () => {
          reject(new Error(`Cannot connect to server at ${apiUrl}`));
        };
        
        xhr.ontimeout = () => {
          reject(new Error('Request timed out. Check your connection.'));
        };
        
        xhr.send();
      });
      
      if (data.success && data.wardrobe) {
        // Access the nested wardrobe structure: wardrobe["wardrobe"][category]
        const wardrobeData = data.wardrobe.wardrobe || data.wardrobe;
        
        // Flatten wardrobe items from all categories
        const items: any[] = [];
        Object.keys(wardrobeData).forEach((category) => {
          if (Array.isArray(wardrobeData[category])) {
            wardrobeData[category].forEach((item: any) => {
              // Build image URL - handle different path formats
              let imageUrl = null;
              if (item.image) {
                const imagePath = item.image.replace(/\\/g, '/');
                
                // Handle absolute Windows paths (E:\path\to\file)
                if (imagePath.includes('wardrobe/')) {
                  // Extract path after wardrobe/ (works for both absolute and relative)
                  const parts = imagePath.split('wardrobe/');
                  if (parts.length > 1) {
                    // Remove any drive letter or leading slashes
                    const relativePath = parts[1].replace(/^[A-Z]:\/?/, '').replace(/^\//, '');
                    imageUrl = `${apiUrl}/static/wardrobe/${relativePath}`;
                  }
                } else if (imagePath.includes('uploads/')) {
                  // Extract path after uploads/
                  const parts = imagePath.split('uploads/');
                  if (parts.length > 1) {
                    const relativePath = parts[1].replace(/^[A-Z]:\/?/, '').replace(/^\//, '');
                    imageUrl = `${apiUrl}/static/uploads/${relativePath}`;
                  }
                } else if (imagePath.startsWith('/') || /^[A-Z]:/.test(imagePath)) {
                  // Absolute path (Unix or Windows) - try to extract relative part
                  // Look for aiwork directory
                  if (imagePath.includes('aiwork/')) {
                    const parts = imagePath.split('aiwork/');
                    if (parts.length > 1) {
                      const relativePath = parts[1].replace(/^\//, '');
                      imageUrl = `${apiUrl}/static/${relativePath}`;
                    }
                  } else {
                    // Fallback: try to use as-is after removing drive letter
                    const cleanPath = imagePath.replace(/^[A-Z]:\/?/, '').replace(/^\//, '');
                    imageUrl = `${apiUrl}/static/${cleanPath}`;
                  }
                } else {
                  // Relative path
                  imageUrl = `${apiUrl}/static/${imagePath}`;
                }
              }
              
              items.push({
                ...item,
                category,
                imageUrl,
                color: item.attributes?.color?.color || item.color?.color || item.color || 'Unknown',
                pattern: item.attributes?.pattern?.pattern || item.pattern?.pattern || item.pattern || 'solid',
              });
            });
          }
        });
        setWardrobeItems(items);
        console.log(`Loaded ${items.length} wardrobe items`);
      } else {
        console.error('Wardrobe data format error:', data);
      }
    } catch (err: any) {
      console.error('Error fetching wardrobe:', err);
      // Show error but don't crash - just show empty state
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    return (
      <View style={styles.itemContainer}>
        <View style={styles.itemImageContainer}>
          {item.imageUrl ? (
            <Image 
              source={{ uri: item.imageUrl }} 
              style={styles.itemImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.placeholderImage}>
              <Text style={styles.placeholderText}>No Image</Text>
            </View>
          )}
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.itemCategory}>{item.category || 'Unknown'}</Text>
          {item.color && (
            <Text style={styles.itemDetail}>Color: {item.color}</Text>
          )}
          {item.pattern && (
            <Text style={styles.itemDetail}>Pattern: {item.pattern}</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Text style={styles.backButtonText}>{'<'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Digital Wardrobe</Text>
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={fetchWardrobe}
            activeOpacity={0.7}
          >
            <Text style={styles.refreshButtonText}>↻</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF8C00" />
            <Text style={styles.loadingText}>Loading your wardrobe...</Text>
          </View>
        ) : wardrobeItems.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>👔</Text>
            <Text style={styles.emptyTitle}>Your Wardrobe is Empty</Text>
            <Text style={styles.emptyText}>
              Upload photos and analyze them to start building your digital wardrobe!
            </Text>
            <TouchableOpacity 
              style={styles.goHomeButton}
              onPress={() => router.push('/home')}
            >
              <Text style={styles.goHomeButtonText}>Go to Upload</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.content}>
            <Text style={styles.statsText}>
              {wardrobeItems.length} {wardrobeItems.length === 1 ? 'item' : 'items'} in your wardrobe
            </Text>
            <FlatList
              data={wardrobeItems}
              renderItem={renderItem}
              keyExtractor={(item, index) => `${item.category}-${index}-${item.image || index}`}
              numColumns={2}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          </View>
        )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  backButton: {
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
  headerTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshButtonText: {
    color: '#FF8C00',
    fontSize: 20,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 30,
  },
  goHomeButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FF8C00',
  },
  goHomeButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  statsText: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 20,
    marginTop: 10,
  },
  listContent: {
    paddingBottom: 20,
  },
  itemContainer: {
    width: ITEM_SIZE,
    marginRight: 20,
    marginBottom: 20,
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  itemImageContainer: {
    width: '100%',
    height: ITEM_SIZE,
    backgroundColor: '#3a3a3a', // Grey background as requested
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3a3a3a',
  },
  placeholderText: {
    color: '#6b7280',
    fontSize: 12,
  },
  itemInfo: {
    padding: 12,
  },
  itemCategory: {
    color: '#FF8C00',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  itemDetail: {
    color: '#9ca3af',
    fontSize: 11,
    marginTop: 2,
  },
});
