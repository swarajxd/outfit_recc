// app/wardrobe.tsx
import { useUser } from '@clerk/clerk-expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

const { width } = Dimensions.get('window');
const ITEM_SIZE = (width - 60) / 2;

// ── Candidate IPs to try in order ─────────────────────────────────────────
// Edit this list to match your network. The app tries each one and uses
// the first that responds. You should rarely need to touch this.
const API_CANDIDATES = [
  'http://192.168.1.101:8000',
  'http://192.168.1.102:8000',
  'http://192.168.1.108:8000',
  'http://10.0.0.1:8000',
  'http://localhost:8000',
];
const STORAGE_KEY_API = 'fitsense_api_url';

// ──────────────────────────────────────────────────────────────────────────

export default function Wardrobe() {
  const { user }                          = useUser();
  const router                            = useRouter();
  const [wardrobeItems, setWardrobeItems] = useState<any[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [apiUrl, setApiUrl]               = useState<string | null>(null);
  const [resolving, setResolving]         = useState(true);

  // ── On mount: discover working API URL ──────────────────────────────────
  useEffect(() => {
    discoverApiUrl().then((url) => {
      setApiUrl(url);
      setResolving(false);
    });
  }, []);

  // ── Once we have the URL + user, fetch wardrobe ─────────────────────────
  useEffect(() => {
    if (!resolving && apiUrl && user !== undefined) {
      const uid = getUid();
      fetchWardrobe(apiUrl, uid);
    }
  }, [resolving, apiUrl, user]);

  const getUid = () =>
    user?.id ||
    user?.emailAddresses?.[0]?.emailAddress ||
    'default_user';

  // ── Try each candidate URL, return first that responds ──────────────────
  const discoverApiUrl = async (): Promise<string> => {
    // 1. Try cached URL first (fastest path)
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEY_API);
      if (cached && await pingUrl(cached)) {
        console.log(`✓ Using cached API URL: ${cached}`);
        return cached;
      }
    } catch (_) {}

    // 2. Try all candidates in parallel — use first winner
    console.log('Discovering API URL...');
    const results = await Promise.allSettled(
      API_CANDIDATES.map(async (url) => {
        const ok = await pingUrl(url);
        if (!ok) throw new Error('no response');
        return url;
      })
    );

    for (const r of results) {
      if (r.status === 'fulfilled') {
        const url = r.value;
        console.log(`✓ Found API at: ${url}`);
        try { await AsyncStorage.setItem(STORAGE_KEY_API, url); } catch (_) {}
        return url;
      }
    }

    // 3. Fallback — return first candidate and let the error surface naturally
    console.warn('No API candidate responded, using first candidate');
    return API_CANDIDATES[0];
  };

  // ── Ping a URL with a short timeout ────────────────────────────────────
  const pingUrl = (url: string): Promise<boolean> =>
    new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', `${url}/health`);
      xhr.timeout = 2000; // 2s ping timeout
      xhr.onload    = () => resolve(xhr.status >= 200 && xhr.status < 500);
      xhr.onerror   = () => resolve(false);
      xhr.ontimeout = () => resolve(false);
      xhr.send();
    });

  // ── Main wardrobe fetch ─────────────────────────────────────────────────
  const fetchWardrobe = async (url: string, uid: string) => {
    setLoading(true);
    setError(null);

    try {
      const data = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', `${url}/wardrobe/${uid}`);
        xhr.timeout = 15000; // 15s — wardrobe can be slow if large
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try { resolve(JSON.parse(xhr.responseText)); }
            catch { reject(new Error('Invalid JSON response')); }
          } else {
            reject(new Error(`Server error: ${xhr.status}`));
          }
        };
        xhr.onerror   = () => {
          // IP may have changed — clear cache and retry on next open
          AsyncStorage.removeItem(STORAGE_KEY_API).catch(() => {});
          reject(new Error(`Cannot connect to ${url}`));
        };
        xhr.ontimeout = () => reject(new Error('Request timed out (15s)'));
        xhr.send();
      });

      if (data.success && data.wardrobe) {
        const wardrobeData = data.wardrobe.wardrobe || data.wardrobe;
        const items: any[] = [];

        Object.keys(wardrobeData).forEach((category) => {
          if (!Array.isArray(wardrobeData[category])) return;
          wardrobeData[category].forEach((item: any) => {
            items.push({
              ...item,
              category,
              imageUrl:     buildImageUrl(item.image, url),
              color:        item.attributes?.color?.color    || item.color?.color    || item.color    || null,
              pattern:      item.attributes?.pattern?.pattern || item.pattern?.pattern || item.pattern || null,
              image_source: item.image_source || null,
            });
          });
        });

        setWardrobeItems(items);
        console.log(`✓ Loaded ${items.length} wardrobe items`);
      } else {
        setError('No wardrobe data returned from server');
      }
    } catch (err: any) {
      console.error('Wardrobe fetch error:', err);
      setError(err.message || 'Failed to load wardrobe');
    } finally {
      setLoading(false);
    }
  };

  // ── Build image URL from stored path ───────────────────────────────────
  const buildImageUrl = (imagePath: string | undefined, baseUrl: string): string | null => {
    if (!imagePath) return null;
    const p = imagePath.replace(/\\/g, '/');

    // Already a full URL
    if (p.startsWith('http://') || p.startsWith('https://')) return p;

    // Extract meaningful relative segment
    for (const marker of ['_mannequin/', '_segmented/', 'wardrobe/', 'uploads/']) {
      const idx = p.indexOf(marker);
      if (idx !== -1) {
        const rel = p.slice(idx).replace(/^[A-Z]:\//, '');
        return `${baseUrl}/static/uploads/${rel}`;
      }
    }

    // aiwork-relative path
    const aiIdx = p.indexOf('aiwork/');
    if (aiIdx !== -1) {
      return `${baseUrl}/static/${p.slice(aiIdx + 'aiwork/'.length)}`;
    }

    // Last resort — strip drive letter
    const clean = p.replace(/^[A-Z]:\//, '').replace(/^\//, '');
    return `${baseUrl}/static/${clean}`;
  };

  const handleRefresh = () => {
    if (apiUrl) {
      fetchWardrobe(apiUrl, getUid());
    } else {
      setResolving(true);
      discoverApiUrl().then((url) => {
        setApiUrl(url);
        setResolving(false);
        fetchWardrobe(url, getUid());
      });
    }
  };

  const handleRetry = () => {
    // Clear cached URL so we re-discover
    AsyncStorage.removeItem(STORAGE_KEY_API).catch(() => {});
    setApiUrl(null);
    setResolving(true);
    discoverApiUrl().then((url) => {
      setApiUrl(url);
      setResolving(false);
      fetchWardrobe(url, getUid());
    });
  };

  // ── Render item card ────────────────────────────────────────────────────
  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const isAI = item.image_source === 'imagen3_mannequin';
    return (
      <View style={[
        styles.card,
        index % 2 === 0 ? styles.cardLeft : styles.cardRight,
        isAI && styles.cardAI,
      ]}>
        <View style={styles.imageBox}>
          {item.imageUrl ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.itemImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderIcon}>👔</Text>
              <Text style={styles.placeholderText}>No Image</Text>
            </View>
          )}
          {isAI && (
            <View style={styles.aiBadge}>
              <Text style={styles.aiBadgeText}>✨ AI</Text>
            </View>
          )}
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardCategory}>{item.category || 'Item'}</Text>
          {item.color   && <Text style={styles.cardDetail}>🎨 {item.color}</Text>}
          {item.pattern && item.pattern !== 'solid' && (
            <Text style={styles.cardDetail}>◼ {item.pattern}</Text>
          )}
        </View>
      </View>
    );
  };

  const aiCount = wardrobeItems.filter(i => i.image_source === 'imagen3_mannequin').length;

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
            <Text style={styles.iconBtnText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            Your <Text style={styles.accent}>Closet</Text>
          </Text>
          <TouchableOpacity style={styles.iconBtn} onPress={handleRefresh}>
            <Text style={[styles.iconBtnText, { color: '#FF8C00' }]}>↻</Text>
          </TouchableOpacity>
        </View>

        {/* Server URL pill (debug helper) */}
        {apiUrl && (
          <TouchableOpacity onPress={handleRetry} style={styles.urlPill}>
            <Text style={styles.urlPillText}>
              🌐 {apiUrl.replace('http://', '')}  (tap to retry)
            </Text>
          </TouchableOpacity>
        )}

        {resolving ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#FF8C00" />
            <Text style={styles.loadingText}>Finding server...</Text>
          </View>

        ) : loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#FF8C00" />
            <Text style={styles.loadingText}>Loading your wardrobe...</Text>
            <Text style={styles.loadingSubtext}>AI images may take a moment</Text>
          </View>

        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>Connection Error</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.errorHint}>
              Make sure your PC is running:  python api.py
            </Text>
            <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>

        ) : wardrobeItems.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyIcon}>👗</Text>
            <Text style={styles.emptyTitle}>Wardrobe is Empty</Text>
            <Text style={styles.emptyText}>Upload an outfit to get started.</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/home')}>
              <Text style={styles.primaryBtnText}>Upload Outfit</Text>
            </TouchableOpacity>
          </View>

        ) : (
          <View style={styles.content}>
            <View style={styles.statsRow}>
              <Text style={styles.statsText}>
                {wardrobeItems.length} {wardrobeItems.length === 1 ? 'item' : 'items'}
              </Text>
              {aiCount > 0 && (
                <View style={styles.aiPill}>
                  <Text style={styles.aiPillText}>✨ {aiCount} AI Generated</Text>
                </View>
              )}
            </View>

            <FlatList
              data={wardrobeItems}
              renderItem={renderItem}
              keyExtractor={(item, idx) => `${item.category}-${idx}-${item.image || idx}`}
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

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  safeArea:   { flex: 1, backgroundColor: '#111' },
  container:  { flex: 1, backgroundColor: '#111' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 50, paddingBottom: 16,
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center',
  },
  iconBtnText: { color: '#fff', fontSize: 22, fontWeight: '600' },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  accent:      { color: '#FF8C00' },

  urlPill: {
    alignSelf: 'center', marginBottom: 8,
    backgroundColor: '#1e1e1e', paddingHorizontal: 12,
    paddingVertical: 4, borderRadius: 20,
    borderWidth: 1, borderColor: '#333',
  },
  urlPillText: { color: '#666', fontSize: 11 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },

  loadingText:    { color: '#fff', fontSize: 16, fontWeight: '600', marginTop: 20 },
  loadingSubtext: { color: '#9ca3af', fontSize: 13, marginTop: 6 },

  errorIcon:  { fontSize: 48, marginBottom: 12 },
  errorTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  errorText:  { color: '#f87171', fontSize: 13, textAlign: 'center', marginBottom: 8 },
  errorHint:  { color: '#6b7280', fontSize: 12, textAlign: 'center', marginBottom: 20 },

  retryBtn:     { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12, backgroundColor: '#FF8C00' },
  retryBtnText: { color: '#000', fontWeight: '700', fontSize: 15 },

  emptyIcon:  { fontSize: 64, marginBottom: 20 },
  emptyTitle: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 10, textAlign: 'center' },
  emptyText:  { color: '#9ca3af', fontSize: 14, textAlign: 'center', marginBottom: 28 },

  primaryBtn:     { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12, backgroundColor: '#FF8C00' },
  primaryBtnText: { color: '#000', fontSize: 16, fontWeight: '700' },

  content:  { flex: 1, paddingHorizontal: 20 },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 16 },
  statsText:{ color: '#9ca3af', fontSize: 14 },

  aiPill:     { backgroundColor: '#FF8C0022', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: '#FF8C0055' },
  aiPillText: { color: '#FF8C00', fontSize: 12, fontWeight: '700' },

  listContent: { paddingBottom: 30 },

  card: {
    width: ITEM_SIZE, marginBottom: 20,
    backgroundColor: '#1e1e1e', borderRadius: 16,
    overflow: 'hidden', borderWidth: 1, borderColor: '#2e2e2e',
  },
  cardAI:    { borderColor: '#FF8C0066' },
  cardLeft:  { marginRight: 10 },
  cardRight: { marginLeft: 10 },

  imageBox: { width: '100%', height: ITEM_SIZE, backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' },
  itemImage: { width: '100%', height: '100%' },

  placeholder:     { alignItems: 'center', justifyContent: 'center' },
  placeholderIcon: { fontSize: 32, marginBottom: 6 },
  placeholderText: { color: '#6b7280', fontSize: 11 },

  aiBadge:     { position: 'absolute', top: 8, right: 8, backgroundColor: '#FF8C00', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  aiBadgeText: { color: '#000', fontSize: 10, fontWeight: '800' },

  cardInfo:     { padding: 12 },
  cardCategory: { color: '#fff', fontSize: 13, fontWeight: '700', textTransform: 'capitalize', marginBottom: 4 },
  cardDetail:   { color: '#9ca3af', fontSize: 11, marginTop: 2 },
});