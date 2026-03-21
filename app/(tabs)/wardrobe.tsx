import { useUser } from "@clerk/clerk-expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from "expo-blur";
import Constants from "expo-constants";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  buildWardrobeFromItems,
  FALLBACK_WARDROBE,
  GeneratedOutfit,
  getOrCreateDailyOutfit,
} from "../utils/outfitEngine";

const DEFAULT_SERVER_BASE: string =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  (Constants.expoConfig?.extra as any)?.API_BASE_URL ||
  "http://localhost:4000";

const API_BASE_STORAGE_KEY = "fitsense_api_base_url";

const PRIMARY     = "#FF6B00";
const BG          = "#000000";
const CHARCOAL    = "#1A1A1A";
const SOFT_GREY   = "#262626";
const SURFACE_LOW = "#141414";
const DEFAULT_AVATAR =
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&q=80";

interface WardrobeItem {
  id: string;
  image: string;
  category: string;
}

function displayCategory(cat: string) {
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

export default function WardrobeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useUser();

  const [serverBase, setServerBase]         = useState<string>(DEFAULT_SERVER_BASE);
  const [isConfigOpen, setIsConfigOpen]     = useState(false);
  const [tempServerBase, setTempServerBase] = useState<string>(DEFAULT_SERVER_BASE);

  // Upload mode picker
  const [showModePicker, setShowModePicker] = useState(false);
  const modeResolveRef = React.useRef<((v: boolean) => void) | null>(null);

  const [activeCategory, setActiveCategory] = useState(0);
  const [items, setItems]                   = useState<WardrobeItem[]>([]);
  const [isLoading, setIsLoading]           = useState(true);
  const [isUploading, setIsUploading]       = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");

  const userId     = user?.id || "default_user";
  const userAvatar =
    (user?.unsafeMetadata as { profileImageUrl?: string })?.profileImageUrl ||
    user?.imageUrl ||
    DEFAULT_AVATAR;

  // ── Fetch wardrobe ──────────────────────────────────────────────────────
  const fetchWardrobe = useCallback(async () => {
    setIsLoading(true);
    try {
      const resp = await fetch(
        `${serverBase}/api/profile/segmented/${encodeURIComponent(userId)}`
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
  }, [userId, serverBase]);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(API_BASE_STORAGE_KEY);
        if (stored?.trim()) setServerBase(stored.trim());
      } catch {}
    })();
  }, []);

  useEffect(() => { fetchWardrobe(); }, [fetchWardrobe]);

  // ── Mode picker — returns Promise<boolean> ──────────────────────────────
  const askUploadMode = (): Promise<boolean> =>
    new Promise((resolve) => {
      modeResolveRef.current = resolve;
      setShowModePicker(true);
    });

  const confirmMode = (chosen: boolean) => {
    setShowModePicker(false);
    modeResolveRef.current?.(chosen);
    modeResolveRef.current = null;
  };

  // ── Upload ──────────────────────────────────────────────────────────────
  const uploadToWardrobe = async () => {
    const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permResult.granted) {
      Alert.alert("Permission Required", "Allow access to your photo library.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0]) return;

    // Ask which mode before starting upload
    const chosenImagen3 = await askUploadMode();

    const asset = result.assets[0];
    setIsUploading(true);
    setUploadProgress(
      chosenImagen3
        ? "Uploading · AI mannequin mode (~60s)…"
        : "Uploading · Fast mode…"
    );

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
      formData.append("use_imagen", chosenImagen3 ? "true" : "false");

      const uploadResp = await fetch(
        `${serverBase}/api/profile/upload-wardrobe`,
        { method: "POST", body: formData }
      );
      if (!uploadResp.ok) throw new Error("Upload failed");
      const uploadJson = await uploadResp.json();
      const jobId = uploadJson.job_id;
      if (!jobId) throw new Error("No job_id returned");

      setUploadProgress(
        chosenImagen3
          ? "Generating AI mannequin images…"
          : "Detecting & segmenting items…"
      );

      let attempts = 0;
      const poll = async (): Promise<void> => {
        attempts++;
        const statusResp = await fetch(
          `${serverBase}/api/profile/job/${encodeURIComponent(jobId)}`
        );
        const statusJson = await statusResp.json();

        if (statusJson.status === "completed") {
          const added   = statusJson.results?.items_added || 0;
          const isDup   = statusJson.results?.all_duplicates;
          const aiCount = statusJson.results?.items_imagen3 || 0;

          setUploadProgress("");
          setIsUploading(false);

          Alert.alert(
            isDup ? "Already in wardrobe" : "Done!",
            isDup
              ? "These items are already in your wardrobe."
              : chosenImagen3
              ? `${added} item(s) added with AI mannequin images (${aiCount} generated).`
              : `${added} item(s) added in fast mode.`
          );
          fetchWardrobe();
          return;
        }
        if (statusJson.status === "error")
          throw new Error(statusJson.error || "Processing failed");
        if (attempts >= 120) throw new Error("Processing timed out");
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

  // ── Today's outfit ──────────────────────────────────────────────────────
  const [todayOutfit, setTodayOutfit] = useState<GeneratedOutfit | null>(null);

  useEffect(() => {
    if (items.length === 0) {
      getOrCreateDailyOutfit(FALLBACK_WARDROBE).then(setTodayOutfit).catch(() => {});
      return;
    }
    getOrCreateDailyOutfit(buildWardrobeFromItems(items))
      .then(setTodayOutfit)
      .catch(() => {});
  }, [items]);

  // ── Category filter ─────────────────────────────────────────────────────
  const categories = useMemo(() => {
    const unique = Array.from(new Set(items.map((i) => i.category)));
    unique.sort();
    return ["All", ...unique.map(displayCategory)];
  }, [items]);

  const filtered =
    activeCategory === 0
      ? items
      : items.filter(
          (item) => displayCategory(item.category) === categories[activeCategory]
        );

  const leftCol  = filtered.filter((_, i) => i % 2 === 0);
  const rightCol = filtered.filter((_, i) => i % 2 !== 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Image source={{ uri: userAvatar }} style={styles.avatar} />
            <View>
              <Text style={styles.headerTitle}>Virtual Wardrobe</Text>
              <Text style={styles.headerSub}>FITSENSE AI</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity style={styles.searchBtn}>
              <Text style={{ color: "#fff", fontSize: 18 }}>⌕</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.ipBtn}
              onPress={() => { setTempServerBase(serverBase); setIsConfigOpen(true); }}
            >
              <Text style={styles.ipBtnText}>IP</Text>
            </TouchableOpacity>
          </View>
        </View>

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
              <Text style={[styles.chipText, activeCategory === i && styles.chipTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Today's Outfit Banner ─────────────────────────────────────────── */}
      {todayOutfit && (
        <View style={styles.outfitBanner}>
          <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={["rgba(255,107,0,0.12)", "rgba(255,107,0,0.0)"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
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

      {/* ── Grid ─────────────────────────────────────────────────────────── */}
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
              Tap + to add outfit photos and build your digital wardrobe.
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            <View style={styles.column}>
              {leftCol.map((item) => <WardrobeCard key={item.id} item={item} />)}
            </View>
            <View style={styles.column}>
              {rightCol.map((item) => <WardrobeCard key={item.id} item={item} />)}
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── FAB ──────────────────────────────────────────────────────────── */}
      {isUploading ? (
        <View style={styles.fabWrap}>
          <View style={[styles.fab, { backgroundColor: SOFT_GREY }]}>
            <ActivityIndicator size="small" color="#fff" />
          </View>
          {!!uploadProgress && (
            <View style={styles.progressPill}>
              <Text style={styles.progressText} numberOfLines={1}>{uploadProgress}</Text>
            </View>
          )}
        </View>
      ) : (
        <TouchableOpacity style={styles.fab} onPress={uploadToWardrobe}>
          <Text style={styles.fabIcon}>+</Text>
        </TouchableOpacity>
      )}

      {/* ── Upload mode picker ────────────────────────────────────────────── */}
      {showModePicker && (
        <View style={styles.sheetOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => confirmMode(false)}
          />
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />

          <View style={styles.modeSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>How should we process your outfit?</Text>
            <Text style={styles.sheetSubtitle}>
              Choose a mode. You can pick differently each time you upload.
            </Text>

            {/* Fast mode */}
            <TouchableOpacity
              style={[styles.modeCard, styles.modeCardFast]}
              onPress={() => confirmMode(false)}
              activeOpacity={0.82}
            >
              <View style={styles.modeCardHeader}>
                <View style={[styles.modeIcon, { backgroundColor: "rgba(255,255,255,0.08)" }]}>
                  <Text style={styles.modeIconText}>⚡</Text>
                </View>
                <View style={styles.modeCardBadge}>
                  <Text style={styles.modeCardBadgeText}>~15 sec</Text>
                </View>
              </View>
              <Text style={styles.modeCardTitle}>Fast Mode</Text>
              <Text style={styles.modeCardDesc}>
                Detects and saves items instantly using the cropped photo. No AI generation —
                your actual clothing image is used directly.
              </Text>
              <View style={styles.modeProRow}>
                <Text style={styles.modePro}>✓ Instant results</Text>
                <Text style={styles.modePro}>✓ Uses real photo</Text>
                <Text style={styles.modePro}>✓ No extra cost</Text>
              </View>
            </TouchableOpacity>

            {/* AI Mannequin mode */}
            <TouchableOpacity
              style={[styles.modeCard, styles.modeCardAI]}
              onPress={() => confirmMode(true)}
              activeOpacity={0.82}
            >
              <View style={styles.modeCardHeader}>
                <View style={[styles.modeIcon, { backgroundColor: "rgba(255,107,0,0.15)" }]}>
                  <Text style={styles.modeIconText}>✦</Text>
                </View>
                <View style={[styles.modeCardBadge, { backgroundColor: "rgba(255,107,0,0.18)" }]}>
                  <Text style={[styles.modeCardBadgeText, { color: PRIMARY }]}>~60 sec</Text>
                </View>
              </View>
              <Text style={[styles.modeCardTitle, { color: PRIMARY }]}>AI Mannequin</Text>
              <Text style={styles.modeCardDesc}>
                Gemini Vision analyses your clothing then Imagen3 generates a professional
                product photo on a clean white mannequin — studio quality presentation.
              </Text>
              <View style={styles.modeProRow}>
                <Text style={[styles.modePro, { color: "rgba(255,107,0,0.85)" }]}>✦ Studio-quality photo</Text>
                <Text style={[styles.modePro, { color: "rgba(255,107,0,0.85)" }]}>✦ Clean white background</Text>
                <Text style={[styles.modePro, { color: "rgba(255,107,0,0.85)" }]}>✦ Consistent wardrobe look</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetCancel}
              onPress={() => {
                setShowModePicker(false);
                modeResolveRef.current?.(false);
                modeResolveRef.current = null;
              }}
            >
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── IP config overlay ─────────────────────────────────────────────── */}
      {isConfigOpen && (
        <View style={styles.ipOverlay}>
          <View style={styles.overlayCard}>
            <Text style={styles.overlayTitle}>Set Server IP</Text>
            <Text style={styles.overlaySubtitle}>
              Enter the base URL of your laptop (e.g. http://192.168.0.10:4000).
            </Text>
            <TextInput
              style={styles.overlayInput}
              placeholder="http://192.168.x.x:4000"
              placeholderTextColor="rgba(255,255,255,0.4)"
              autoCapitalize="none"
              autoCorrect={false}
              value={tempServerBase}
              onChangeText={setTempServerBase}
            />
            <View style={styles.overlayButtons}>
              <TouchableOpacity
                style={[styles.overlayButton, styles.overlayButtonSecondary]}
                onPress={() => setIsConfigOpen(false)}
              >
                <Text style={styles.overlayButtonTextSecondary}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.overlayButton, styles.overlayButtonPrimary]}
                onPress={async () => {
                  const trimmed = tempServerBase.trim();
                  if (!trimmed) return;
                  setServerBase(trimmed);
                  try { await AsyncStorage.setItem(API_BASE_STORAGE_KEY, trimmed); } catch {}
                  setIsConfigOpen(false);
                }}
              >
                <Text style={styles.overlayButtonTextPrimary}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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

  // Header
  header: {
    backgroundColor: "rgba(0,0,0,0.88)",
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)",
  },
  headerRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 16,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "800", letterSpacing: -0.3 },
  headerSub: { color: PRIMARY, fontSize: 9, fontWeight: "800", letterSpacing: 3, textTransform: "uppercase", marginTop: 2 },
  searchBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center", justifyContent: "center",
  },
  chipsRow: { gap: 8, paddingBottom: 8 },
  chip: {
    paddingHorizontal: 20, paddingVertical: 8, borderRadius: 999,
    backgroundColor: SOFT_GREY, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)",
  },
  chipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  chipText: { color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 },
  chipTextActive: { color: "#fff" },

  // Grid
  scrollContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 140 },
  grid: { flexDirection: "row", gap: 14 },
  column: { flex: 1, gap: 16 },
  card: { backgroundColor: CHARCOAL, borderRadius: 20, overflow: "hidden" },
  cardImageWrapper: { aspectRatio: 3 / 4, backgroundColor: SOFT_GREY, alignItems: "center", justifyContent: "center", padding: 16 },
  cardImage: { width: "100%", height: "100%", resizeMode: "cover", borderRadius: 12 },
  cardInfo: { padding: 12, gap: 4 },
  tagRow: { flexDirection: "row" },
  tag: { backgroundColor: PRIMARY, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  tagText: { color: "#fff", fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },

  // States
  centered: { alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  loadingText: { color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: "600", marginTop: 8 },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  emptySubtext: { color: "rgba(255,255,255,0.4)", fontSize: 13, textAlign: "center", paddingHorizontal: 40 },

  // FAB
  fabWrap: { position: "absolute", bottom: 96, right: 20, alignItems: "flex-end", gap: 10 },
  fab: {
    width: 54, height: 54, borderRadius: 27, backgroundColor: PRIMARY,
    alignItems: "center", justifyContent: "center",
    shadowColor: PRIMARY, shadowRadius: 18, shadowOpacity: 0.55,
    shadowOffset: { width: 0, height: 4 }, elevation: 14,
  },
  fabIcon: { color: "#fff", fontSize: 28, fontWeight: "300", lineHeight: 32 },
  progressPill: {
    backgroundColor: "rgba(20,20,20,0.92)", borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1, borderColor: "rgba(255,107,0,0.25)", maxWidth: 240,
  },
  progressText: { color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "600" },

  // Today's outfit
  outfitBanner: {
    marginHorizontal: 16, marginBottom: 8, borderRadius: 18, overflow: "hidden",
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14, position: "relative",
  },
  outfitBannerBorder: {
    ...StyleSheet.absoluteFillObject, borderRadius: 18,
    borderWidth: 1, borderColor: "rgba(255,107,0,0.25)",
  },
  outfitBannerLeft: { flex: 1 },
  outfitBannerLabel: { color: PRIMARY, fontSize: 11, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 },
  outfitBannerItems: { flexDirection: "row", gap: 12 },
  outfitBannerItem: { alignItems: "center", gap: 4 },
  outfitBannerEmoji: { fontSize: 24 },
  outfitBannerName: { color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: "600", maxWidth: 72, textAlign: "center" },
  outfitBannerChevron: { color: "rgba(255,255,255,0.35)", fontSize: 22, fontWeight: "300" },

  // Mode picker sheet
  sheetOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: "flex-end",
  },
  modeSheet: {
    backgroundColor: "#111",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40,
    gap: 14, borderTopWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignSelf: "center", marginBottom: 4,
  },
  sheetTitle: { color: "#fff", fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  sheetSubtitle: { color: "rgba(255,255,255,0.45)", fontSize: 13, marginTop: -6 },
  modeCard: { borderRadius: 20, padding: 18, gap: 8, borderWidth: 1 },
  modeCardFast: { backgroundColor: SURFACE_LOW, borderColor: "rgba(255,255,255,0.08)" },
  modeCardAI: { backgroundColor: "rgba(255,107,0,0.06)", borderColor: "rgba(255,107,0,0.3)" },
  modeCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modeIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  modeIconText: { fontSize: 18 },
  modeCardBadge: { backgroundColor: "rgba(255,255,255,0.08)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  modeCardBadgeText: { color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: "700" },
  modeCardTitle: { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: -0.2 },
  modeCardDesc: { color: "rgba(255,255,255,0.5)", fontSize: 12, lineHeight: 18 },
  modeProRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
  modePro: { color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: "600" },
  sheetCancel: {
    alignItems: "center", paddingVertical: 12, borderRadius: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", marginTop: 2,
  },
  sheetCancelText: { color: "rgba(255,255,255,0.5)", fontSize: 14, fontWeight: "600" },

  // IP config
  ipOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center", justifyContent: "center", paddingHorizontal: 24,
  },
  overlayCard: {
    width: "100%", borderRadius: 18, backgroundColor: "#111",
    padding: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", gap: 12,
  },
  overlayTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  overlaySubtitle: { color: "rgba(255,255,255,0.6)", fontSize: 12 },
  overlayInput: {
    marginTop: 4, borderRadius: 10, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)", paddingHorizontal: 10,
    paddingVertical: 8, color: "#fff", fontSize: 13, backgroundColor: "rgba(0,0,0,0.7)",
  },
  overlayButtons: { marginTop: 10, flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  overlayButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  overlayButtonSecondary: { borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  overlayButtonPrimary: { backgroundColor: PRIMARY },
  overlayButtonTextSecondary: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "600" },
  overlayButtonTextPrimary: { color: "#fff", fontSize: 12, fontWeight: "700" },
  ipBtn: {
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  ipBtnText: { color: "#fff", fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
});