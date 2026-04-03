import { useUser } from "@clerk/clerk-expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from "expo-blur";
import Constants from "expo-constants";
import * as ImagePicker from "expo-image-picker";
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
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
import { SERVER_BASE } from "../utils/config";
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

const PRIMARY = "#FF6B00";
const BG = "#000000";
const CHARCOAL = "#1A1A1A";
const SOFT_GREY = "#262626";
const SURFACE_LOW = "#141414";
const DANGER = "#FF3B30";
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

  const [serverBase, setServerBase] = useState<string>(DEFAULT_SERVER_BASE);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [tempServerBase, setTempServerBase] =
    useState<string>(DEFAULT_SERVER_BASE);

  // Upload mode picker
  const [showModePicker, setShowModePicker] = useState(false);
  const modeResolveRef = useRef<((v: boolean) => void) | null>(null);

  // Selection / delete mode
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  const [activeCategory, setActiveCategory] = useState(0);
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [todayOutfit, setTodayOutfit] = useState<GeneratedOutfit | null>(null);

  const userId = user?.id || "default_user";
  const userAvatar =
    (user?.unsafeMetadata as { profileImageUrl?: string })?.profileImageUrl ||
    user?.imageUrl ||
    DEFAULT_AVATAR;

  // ── Fetch wardrobe ──────────────────────────────────────────────────────
  const fetchWardrobe = useCallback(async () => {
    setIsLoading(true);
    try {
      const resp = await fetch(
        `${SERVER_BASE}/api/profile/wardrobe/${encodeURIComponent(userId)}`,
      );
      if (!resp.ok) throw new Error("Failed to fetch wardrobe");
      const json = await resp.json();
      const w = json?.wardrobe || {};
      const fetched: WardrobeItem[] = [];
      for (const key of Object.keys(w)) {
        const arr = Array.isArray(w[key]) ? w[key] : [];
        for (const item of arr) {
          fetched.push({
            id: item.id || String(Math.random()),
            image: item.image,
            category: item.category || key.replace(/s$/, "") || "other",
          });
        }
      }
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

  useEffect(() => {
    fetchWardrobe();
  }, [fetchWardrobe]);

  // ── Today's outfit ──────────────────────────────────────────────────────
  useEffect(() => {
    if (items.length === 0) {
      getOrCreateDailyOutfit(FALLBACK_WARDROBE)
        .then(setTodayOutfit)
        .catch(() => {});
      return;
    }
    getOrCreateDailyOutfit(buildWardrobeFromItems(items))
      .then(setTodayOutfit)
      .catch(() => {});
  }, [items]);

  // ── Selection helpers ───────────────────────────────────────────────────
  const enterSelectionMode = (itemId: string) => {
    setSelectionMode(true);
    setSelectedIds(new Set([itemId]));
  };

  const toggleSelection = (itemId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(itemId) ? next.delete(itemId) : next.add(itemId);
      return next;
    });
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const selectAll = () => setSelectedIds(new Set(filtered.map((i) => i.id)));

  // ── Delete selected ─────────────────────────────────────────────────────
  const deleteSelected = () => {
    if (selectedIds.size === 0) return;
    Alert.alert(
      "Delete Items",
      `Remove ${selectedIds.size} item${selectedIds.size > 1 ? "s" : ""} from your wardrobe?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setIsDeleting(true);
            try {
              await Promise.all(
                Array.from(selectedIds).map((id) =>
                  fetch(
                    `${serverBase}/api/profile/wardrobe/${encodeURIComponent(userId)}/item/${encodeURIComponent(id)}`,
                    { method: "DELETE" },
                  ).catch((e) => console.warn(`Delete ${id} failed:`, e)),
                ),
              );
              // Optimistically remove from UI without refetch
              setItems((prev) =>
                prev.filter((item) => !selectedIds.has(item.id)),
              );
              exitSelectionMode();
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to delete items");
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ],
    );
  };

  // ── Mode picker ─────────────────────────────────────────────────────────
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

    const chosenImagen3 = await askUploadMode();
    const asset = result.assets[0];
    setIsUploading(true);
    setUploadProgress(
      chosenImagen3
        ? "Uploading · AI mannequin mode (~60s)…"
        : "Uploading · Fast mode…",
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
        { method: "POST", body: formData },
      );
      if (!uploadResp.ok) throw new Error("Upload failed");
      const { job_id: jobId } = await uploadResp.json();
      if (!jobId) throw new Error("No job_id returned");

      setUploadProgress(
        chosenImagen3
          ? "Generating AI mannequin images…"
          : "Detecting & segmenting items…",
      );

      let attempts = 0;
      const poll = async (): Promise<void> => {
        attempts++;
        const statusJson = await (
          await fetch(
            `${serverBase}/api/profile/job/${encodeURIComponent(jobId)}`,
          )
        ).json();
        if (statusJson.status === "completed") {
          const added = statusJson.results?.items_added || 0;
          const isDup = statusJson.results?.all_duplicates;
          const ai = statusJson.results?.items_imagen3 || 0;
          setUploadProgress("");
          setIsUploading(false);
          Alert.alert(
            isDup ? "Already in wardrobe" : "Done!",
            isDup
              ? "These items are already in your wardrobe."
              : chosenImagen3
                ? `${added} item(s) added with AI mannequin images (${ai} generated).`
                : `${added} item(s) added in fast mode.`,
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
      console.error("upload error:", err);
      Alert.alert("Error", err.message || "Failed to process image");
      setIsUploading(false);
      setUploadProgress("");
    }
  };

  // ── Category filter ─────────────────────────────────────────────────────
  const categories = useMemo(() => {
    const unique = Array.from(new Set(items.map((i) => i.category))).sort();
    return ["All", ...unique.map(displayCategory)];
  }, [items]);

  const filtered =
    activeCategory === 0
      ? items
      : items.filter(
          (item) =>
            displayCategory(item.category) === categories[activeCategory],
        );

  const leftCol = filtered.filter((_, i) => i % 2 === 0);
  const rightCol = filtered.filter((_, i) => i % 2 !== 0);

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            {selectionMode ? (
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={exitSelectionMode}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            ) : (
              <>
                <Image source={{ uri: userAvatar }} style={styles.avatar} />
                <View>
                  <Text style={styles.headerTitle}>Virtual Wardrobe</Text>
                  <Text style={styles.headerSub}>FITSENSE AI</Text>
                </View>
              </>
            )}
          </View>

          <View style={{ flexDirection: "row", gap: 8 }}>
            {selectionMode ? (
              <>
                <TouchableOpacity
                  style={styles.selectAllBtn}
                  onPress={selectAll}
                >
                  <Text style={styles.selectAllText}>Select All</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.deleteBtn,
                    selectedIds.size === 0 && styles.deleteBtnDisabled,
                  ]}
                  onPress={deleteSelected}
                  disabled={selectedIds.size === 0 || isDeleting}
                >
                  {isDeleting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.deleteBtnText}>
                      Delete
                      {selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={styles.iconBtn}>
                  <Text style={{ color: "#fff", fontSize: 18 }}>⌕</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.ipBtn}
                  onPress={() => {
                    setTempServerBase(serverBase);
                    setIsConfigOpen(true);
                  }}
                >
                  <Text style={styles.ipBtnText}>IP</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Selection hint */}
        {selectionMode ? (
          <View style={styles.selectionBar}>
            <Text style={styles.selectionBarText}>
              {selectedIds.size === 0
                ? "Tap items to select"
                : `${selectedIds.size} item${selectedIds.size > 1 ? "s" : ""} selected`}
            </Text>
          </View>
        ) : (
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
        )}
      </View>

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
              Tap + to add outfit photos and build your digital wardrobe.
            </Text>
          </View>
        ) : (
          <>
            {!selectionMode && (
              <Text style={styles.hintText}>
                Long press an item to select and delete
              </Text>
            )}
            <View style={styles.grid}>
              <View style={styles.column}>
                {leftCol.map((item) => (
                  <WardrobeCard
                    key={item.id}
                    item={item}
                    selectionMode={selectionMode}
                    selected={selectedIds.has(item.id)}
                    onLongPress={() => enterSelectionMode(item.id)}
                    onPress={() => {
                      if (selectionMode) toggleSelection(item.id);
                    }}
                  />
                ))}
              </View>
              <View style={styles.column}>
                {rightCol.map((item) => (
                  <WardrobeCard
                    key={item.id}
                    item={item}
                    selectionMode={selectionMode}
                    selected={selectedIds.has(item.id)}
                    onLongPress={() => enterSelectionMode(item.id)}
                    onPress={() => {
                      if (selectionMode) toggleSelection(item.id);
                    }}
                  />
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* FAB — hidden in selection mode */}
      {!selectionMode &&
        (isUploading ? (
          <View style={styles.fabWrap}>
            <View style={[styles.fab, { backgroundColor: SOFT_GREY }]}>
              <ActivityIndicator size="small" color="#fff" />
            </View>
            {!!uploadProgress && (
              <View style={styles.progressPill}>
                <Text style={styles.progressText} numberOfLines={1}>
                  {uploadProgress}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <TouchableOpacity style={styles.fab} onPress={uploadToWardrobe}>
            <Text style={styles.fabIcon}>+</Text>
          </TouchableOpacity>
        ))}

      {/* Upload mode picker sheet */}
      {showModePicker && (
        <View style={styles.sheetOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => confirmMode(false)}
          />
          <BlurView
            intensity={30}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.modeSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>
              How should we process your outfit?
            </Text>
            <Text style={styles.sheetSubtitle}>
              Choose a mode. You can pick differently each time.
            </Text>

            <TouchableOpacity
              style={[styles.modeCard, styles.modeCardFast]}
              onPress={() => confirmMode(false)}
              activeOpacity={0.82}
            >
              <View style={styles.modeCardHeader}>
                <View
                  style={[
                    styles.modeIcon,
                    { backgroundColor: "rgba(255,255,255,0.08)" },
                  ]}
                >
                  <Text style={styles.modeIconText}>⚡</Text>
                </View>
                <View style={styles.modeCardBadge}>
                  <Text style={styles.modeCardBadgeText}>~15 sec</Text>
                </View>
              </View>
              <Text style={styles.modeCardTitle}>Fast Mode</Text>
              <Text style={styles.modeCardDesc}>
                Detects and saves items instantly using the cropped photo. No AI
                generation — your actual clothing image is used directly.
              </Text>
              <View style={styles.modeProRow}>
                <Text style={styles.modePro}>✓ Instant results</Text>
                <Text style={styles.modePro}>✓ Uses real photo</Text>
                <Text style={styles.modePro}>✓ No extra cost</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeCard, styles.modeCardAI]}
              onPress={() => confirmMode(true)}
              activeOpacity={0.82}
            >
              <View style={styles.modeCardHeader}>
                <View
                  style={[
                    styles.modeIcon,
                    { backgroundColor: "rgba(255,107,0,0.15)" },
                  ]}
                >
                  <Text style={styles.modeIconText}>✦</Text>
                </View>
                <View
                  style={[
                    styles.modeCardBadge,
                    { backgroundColor: "rgba(255,107,0,0.18)" },
                  ]}
                >
                  <Text style={[styles.modeCardBadgeText, { color: PRIMARY }]}>
                    ~60 sec
                  </Text>
                </View>
              </View>
              <Text style={[styles.modeCardTitle, { color: PRIMARY }]}>
                AI Mannequin
              </Text>
              <Text style={styles.modeCardDesc}>
                Gemini Vision analyses your clothing then Imagen3 generates a
                professional product photo on a clean white mannequin.
              </Text>
              <View style={styles.modeProRow}>
                <Text
                  style={[styles.modePro, { color: "rgba(255,107,0,0.85)" }]}
                >
                  ✦ Studio-quality photo
                </Text>
                <Text
                  style={[styles.modePro, { color: "rgba(255,107,0,0.85)" }]}
                >
                  ✦ Clean white background
                </Text>
                <Text
                  style={[styles.modePro, { color: "rgba(255,107,0,0.85)" }]}
                >
                  ✦ Consistent wardrobe look
                </Text>
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

      {/* IP config overlay */}
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
                  try {
                    await AsyncStorage.setItem(API_BASE_STORAGE_KEY, trimmed);
                  } catch {}
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

// ── WardrobeCard ──────────────────────────────────────────────────────────────

function WardrobeCard({
  item,
  selectionMode,
  selected,
  onLongPress,
  onPress,
}: {
  item: WardrobeItem;
  selectionMode: boolean;
  selected: boolean;
  onLongPress: () => void;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onLongPress={onLongPress}
      onPress={onPress}
      activeOpacity={0.85}
      delayLongPress={350}
    >
      <View style={[styles.card, selected && styles.cardSelected]}>
        <View style={styles.cardImageWrapper}>
          <Image source={{ uri: item.image }} style={styles.cardImage} />

          {/* Dim unselected cards in selection mode */}
          {selectionMode && !selected && <View style={styles.dimOverlay} />}

          {/* Selection badge */}
          {selectionMode && (
            <View style={styles.selectionBadge}>
              <View
                style={[
                  styles.selectionCircle,
                  selected && styles.selectionCircleActive,
                ]}
              >
                {selected && <Text style={styles.selectionCheck}>✓</Text>}
              </View>
            </View>
          )}
        </View>
        <View style={styles.cardInfo}>
          <View style={styles.tagRow}>
            <View style={[styles.tag, selected && styles.tagDanger]}>
              <Text style={styles.tagText}>
                {displayCategory(item.category)}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

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
    marginBottom: 12,
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

  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  ipBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  ipBtnText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  // Selection mode header
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  cancelBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  selectAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  selectAllText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    fontWeight: "600",
  },
  deleteBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: DANGER,
    minWidth: 90,
    alignItems: "center",
  },
  deleteBtnDisabled: { backgroundColor: "rgba(255,59,48,0.3)" },
  deleteBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  selectionBar: { paddingVertical: 8, alignItems: "center" },
  selectionBarText: { color: "rgba(255,255,255,0.4)", fontSize: 12 },

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

  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 140 },
  hintText: {
    color: "rgba(255,255,255,0.2)",
    fontSize: 11,
    textAlign: "center",
    marginBottom: 14,
  },
  grid: { flexDirection: "row", gap: 14 },
  column: { flex: 1, gap: 16 },

  // Card
  card: {
    backgroundColor: CHARCOAL,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  cardSelected: { borderColor: DANGER },
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
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 12,
  },
  selectionBadge: { position: "absolute", top: 10, right: 10 },
  selectionCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.8)",
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  selectionCircleActive: { backgroundColor: DANGER, borderColor: DANGER },
  selectionCheck: { color: "#fff", fontSize: 13, fontWeight: "800" },
  cardInfo: { padding: 12, gap: 4 },
  tagRow: { flexDirection: "row" },
  tag: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  tagDanger: { backgroundColor: DANGER },
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
  emptyText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  emptySubtext: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 40,
  },

  fabWrap: {
    position: "absolute",
    bottom: 96,
    right: 20,
    alignItems: "flex-end",
    gap: 10,
  },
  fab: {
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
  fabIcon: { color: "#fff", fontSize: 28, fontWeight: "300", lineHeight: 32 },
  progressPill: {
    backgroundColor: "rgba(20,20,20,0.92)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "rgba(255,107,0,0.25)",
    maxWidth: 240,
  },
  progressText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    fontWeight: "600",
  },

  sheetOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
  },
  modeSheet: {
    backgroundColor: "#111",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 14,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignSelf: "center",
    marginBottom: 4,
  },
  sheetTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  sheetSubtitle: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 13,
    marginTop: -6,
  },
  modeCard: { borderRadius: 20, padding: 18, gap: 8, borderWidth: 1 },
  modeCardFast: {
    backgroundColor: SURFACE_LOW,
    borderColor: "rgba(255,255,255,0.08)",
  },
  modeCardAI: {
    backgroundColor: "rgba(255,107,0,0.06)",
    borderColor: "rgba(255,107,0,0.3)",
  },
  modeCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modeIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modeIconText: { fontSize: 18 },
  modeCardBadge: {
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  modeCardBadgeText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    fontWeight: "700",
  },
  modeCardTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  modeCardDesc: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    lineHeight: 18,
  },
  modeProRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
  modePro: { color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: "600" },
  sheetCancel: {
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    marginTop: 2,
  },
  sheetCancelText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    fontWeight: "600",
  },

  ipOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  overlayCard: {
    width: "100%",
    borderRadius: 18,
    backgroundColor: "#111",
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    gap: 12,
  },
  overlayTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  overlaySubtitle: { color: "rgba(255,255,255,0.6)", fontSize: 12 },
  overlayInput: {
    marginTop: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#fff",
    fontSize: 13,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  overlayButtons: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  overlayButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  overlayButtonSecondary: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  overlayButtonPrimary: { backgroundColor: PRIMARY },
  overlayButtonTextSecondary: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    fontWeight: "600",
  },
  overlayButtonTextPrimary: { color: "#fff", fontSize: 12, fontWeight: "700" },
});
