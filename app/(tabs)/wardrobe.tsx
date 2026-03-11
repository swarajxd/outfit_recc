
import { useUser } from "@clerk/clerk-expo";
import Constants from "expo-constants";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import {
    FALLBACK_WARDROBE,
    GeneratedOutfit,
    getOrCreateDailyOutfit,
} from '../utils/outfitEngine';

const SERVER_BASE =
  (Constants.expoConfig?.extra as any)?.API_BASE_URL ?? "http://localhost:4000";

const PRIMARY = "#FF6B00";
const BG = "#000000";
const CHARCOAL = "#1A1A1A";
const SOFT_GREY = "#262626";
const DEFAULT_AVATAR =
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&q=80";

interface WardrobeItem {
  id: string;
  image: string;
  category: string;
}

/** Capitalise first letter of each word, e.g. "tshirt" → "Tshirt" */
function displayCategory(cat: string) {
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

export default function WardrobeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const [activeCategory, setActiveCategory] = useState(0);
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");

  const userId = user?.id || "default_user";

  const userAvatar =
    (user?.unsafeMetadata as { profileImageUrl?: string })?.profileImageUrl ||
    user?.imageUrl ||
    DEFAULT_AVATAR;

  // Fetch wardrobe items from the same endpoint the profile page uses
  const fetchWardrobe = useCallback(async () => {
    setIsLoading(true);
    try {
      const resp = await fetch(
        `${SERVER_BASE}/api/profile/segmented/${encodeURIComponent(userId)}`,
      );
      if (!resp.ok) throw new Error("Failed to fetch wardrobe");
      const json = await resp.json();
      const fetched: WardrobeItem[] = (json.items || []).map((item: any) => ({
        id: item.id || item.filename || String(Math.random()),
        image: item.image,
        category: item.category || "other",
      }));
      setItems(fetched);
    } catch (err) {
      console.warn("wardrobe fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchWardrobe();
  }, [fetchWardrobe]);

  // ── Upload image to wardrobe pipeline ──────────────────────────────────
  const uploadToWardrobe = async () => {
    const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permResult.granted) {
      Alert.alert(
        "Permission Required",
        "Allow access to your photo library to add wardrobe items.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setIsUploading(true);
    setUploadProgress("Uploading image…");

    try {
      const formData = new FormData();
      if (Platform.OS === "web") {
        const blob = await (await fetch(asset.uri)).blob();
        formData.append("image", blob, "wardrobe.jpg");
      } else {
        formData.append("image", {
          uri: asset.uri,
          type: "image/jpeg",
          name: "wardrobe.jpg",
        } as any);
      }
      formData.append("user_id", userId);

      const uploadResp = await fetch(
        `${SERVER_BASE}/api/profile/upload-wardrobe`,
        { method: "POST", body: formData },
      );
      if (!uploadResp.ok) throw new Error("Upload failed");
      const uploadJson = await uploadResp.json();
      const jobId = uploadJson.job_id;
      if (!jobId) throw new Error("No job_id returned");

      setUploadProgress("Processing outfit…");
      let attempts = 0;
      const maxAttempts = 120;
      const poll = async (): Promise<void> => {
        attempts++;
        const statusResp = await fetch(
          `${SERVER_BASE}/api/profile/job/${encodeURIComponent(jobId)}`,
        );
        const statusJson = await statusResp.json();

        if (statusJson.status === "completed") {
          setUploadProgress("");
          setIsUploading(false);
          Alert.alert(
            "Success",
            `${statusJson.results?.items_total || 0} item(s) added to your wardrobe!`,
          );
          fetchWardrobe();
          return;
        }
        if (statusJson.status === "error") {
          throw new Error(statusJson.error || "Processing failed");
        }
        if (attempts >= maxAttempts) {
          throw new Error("Processing timed out");
        }
        await new Promise((r) => setTimeout(r, 1000));
        return poll();
      };
      await poll();
    } catch (err: any) {
      console.error("wardrobe upload error:", err);
      Alert.alert("Error", err.message || "Failed to process image");
      setIsUploading(false);
      setUploadProgress("");
    }
  };

  // Build dynamic category list from fetched items
  const categories = useMemo(() => {
    const unique = Array.from(new Set(items.map((i) => i.category)));
    unique.sort();
    return ["All", ...unique.map(displayCategory)];
  }, [items]);
  const [todayOutfit, setTodayOutfit] = useState<GeneratedOutfit | null>(null);

  useEffect(() => {
    getOrCreateDailyOutfit(FALLBACK_WARDROBE)
      .then((o) => setTodayOutfit(o))
      .catch(() => {});
  }, []);

  const filtered =
    activeCategory === 0
      ? items
      : items.filter(
          (item) =>
            displayCategory(item.category) === categories[activeCategory],
        );

  const leftCol = filtered.filter((_, i) => i % 2 === 0);
  const rightCol = filtered.filter((_, i) => i % 2 !== 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Image
              source={{
                uri: userAvatar,
              }}
              style={styles.avatar}
            />
            <View>
              <Text style={styles.headerTitle}>Virtual Wardrobe</Text>
              <Text style={styles.headerSub}>FITSENSE AI</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.searchBtn}>
            <Text style={{ color: "#fff", fontSize: 18 }}>⌕</Text>
          </TouchableOpacity>
        </View>

        {/* Category Filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {categories.map((cat, i) => (
            <TouchableOpacity
              key={cat}
              style={[styles.chip, activeCategory === i && styles.chipActive]}
              onPress={() => setActiveCategory(i)}
            >
              <Text
                style={[
                  styles.chipText,
                  activeCategory === i && styles.chipTextActive,
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Today's Outfit Banner */}
      {todayOutfit && (
        <View style={styles.outfitBanner}>
          <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['rgba(255,107,0,0.12)', 'rgba(255,107,0,0.0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.outfitBannerBorder} />
          <View style={styles.outfitBannerLeft}>
            <Text style={styles.outfitBannerLabel}>✦ Today's Outfit</Text>
            <View style={styles.outfitBannerItems}>
              {[todayOutfit.top, todayOutfit.bottom, todayOutfit.footwear].map((item, i) => (
                <View key={i} style={styles.outfitBannerItem}>
                  <Text style={styles.outfitBannerEmoji}>{item.emoji}</Text>
                  <Text style={styles.outfitBannerName} numberOfLines={1}>{item.name}</Text>
                </View>
              ))}
            </View>
          </View>
          <Text style={styles.outfitBannerChevron}>›</Text>
        </View>
      )}

      {/* Grid */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={PRIMARY} />
            <Text style={styles.loadingText}>Loading wardrobe…</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyIcon}>👕</Text>
            <Text style={styles.emptyText}>Your wardrobe is empty</Text>
            <Text style={styles.emptySubtext}>
              Upload outfit photos from your profile to build your digital
              wardrobe.
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            <View style={styles.column}>
              {leftCol.map((item) => (
                <WardrobeCard key={item.id} item={item} />
              ))}
            </View>
            <View style={styles.column}>
              {rightCol.map((item) => (
                <WardrobeCard key={item.id} item={item} />
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      {isUploading ? (
        <View style={styles.fab}>
          <ActivityIndicator size="small" color="#fff" />
        </View>
      ) : (
        <TouchableOpacity style={styles.fab} onPress={uploadToWardrobe}>
          <Text style={styles.fabIcon}>+</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function WardrobeCard({ item }: { item: WardrobeItem }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardImageWrapper}>
        <Image source={{ uri: item.image }} style={styles.cardImage} />
      </View>
      <View style={styles.cardInfo}>
        <View style={styles.tagRow}>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{displayCategory(item.category)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    backgroundColor: "rgba(0,0,0,0.88)",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  headerSub: {
    color: PRIMARY,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 3,
    textTransform: "uppercase",
    marginTop: 2,
  },
  searchBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  chipsRow: { gap: 8, paddingBottom: 8 },
  chip: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: SOFT_GREY,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  chipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  chipText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  chipTextActive: { color: "#fff" },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 140 },
  grid: { flexDirection: "row", gap: 14 },
  column: { flex: 1, gap: 16 },
  card: { backgroundColor: CHARCOAL, borderRadius: 20, overflow: "hidden" },
  cardImageWrapper: {
    aspectRatio: 3 / 4,
    backgroundColor: SOFT_GREY,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  cardImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
    borderRadius: 12,
  },
  cardInfo: { padding: 12, gap: 4 },
  tagRow: { flexDirection: "row" },
  tag: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  tagText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 12,
  },
  loadingText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 8,
  },
  emptyIcon: { fontSize: 48 },
  emptyText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  emptySubtext: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 40,
  },
  fab: {
    position: "absolute",
    bottom: 96,
    right: 20,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PRIMARY,
    shadowRadius: 18,
    shadowOpacity: 0.55,
    shadowOffset: { width: 0, height: 4 },
    elevation: 14,
  },
  fabIcon: { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 32 },

  // Today's Outfit Banner
  outfitBanner: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 18,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    position: 'relative',
  },
  outfitBannerBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,107,0,0.25)',
  },
  outfitBannerLeft: { flex: 1 },
  outfitBannerLabel: {
    color: PRIMARY, fontSize: 11, fontWeight: '800',
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10,
  },
  outfitBannerItems: { flexDirection: 'row', gap: 12 },
  outfitBannerItem: { alignItems: 'center', gap: 4 },
  outfitBannerEmoji: { fontSize: 24 },
  outfitBannerName: {
    color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '600',
    maxWidth: 72, textAlign: 'center',
  },
  outfitBannerChevron: {
    color: 'rgba(255,255,255,0.35)', fontSize: 22, fontWeight: '300',
  },
});
