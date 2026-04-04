/**
 * Wardrobe Screen — Premium UI (from redesign) + Full Logic (from v2)
 */

import { useUser } from "@clerk/clerk-expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
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
  Animated,
  Dimensions,
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
import { WardrobeSkeletonGrid } from "../../components/ui/SkeletonLoader";
import { Colors, Radius, Shadows, Spacing } from "../../constants/theme";
import { SERVER_BASE } from "../utils/config";
import {
  buildWardrobeFromItems,
  FALLBACK_WARDROBE,
  GeneratedOutfit,
  getOrCreateDailyOutfit,
} from "../utils/outfitEngine";

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_W = (SCREEN_W - Spacing.lg * 2 - Spacing.sm) / 2;

const API_BASE_STORAGE_KEY = "fitsense_api_base_url";
const FILTER_CHIPS = ["Color", "Occasion", "Fit", "Season"];

interface WardrobeItem {
  id: string;
  image: string;
  category: string;
}

function displayCategory(cat: string) {
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

// ─── Wardrobe Item Card (Premium UI) ─────────────────────────────────────────
function WardrobeCard({
  item,
  selectionMode,
  selected,
  onLongPress,
  onPress,
  index,
}: {
  item: WardrobeItem;
  selectionMode: boolean;
  selected: boolean;
  onLongPress: () => void;
  onPress: () => void;
  index: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 350,
      delay: index * 50,
      useNativeDriver: true,
    }).start();
  }, []);

  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, friction: 8 }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }).start();

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
          { scale },
        ],
      }}
    >
      <TouchableOpacity
        onLongPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onLongPress();
        }}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        activeOpacity={0.9}
        delayLongPress={350}
      >
        <View style={[wc.card, selected && wc.cardSelected]}>
          {selected && (
            <LinearGradient
              colors={["rgba(232,98,10,0.15)", "transparent"]}
              style={[StyleSheet.absoluteFill, { borderRadius: Radius.lg }]}
            />
          )}
          <View style={wc.imgWrap}>
            <Image source={{ uri: item.image }} style={wc.img} resizeMode="cover" />
            {selectionMode && !selected && <View style={wc.dim} />}
            {selectionMode && (
              <View style={wc.checkWrap}>
                <View style={[wc.check, selected && wc.checkActive]}>
                  {selected && <Text style={wc.checkTxt}>✓</Text>}
                </View>
              </View>
            )}
          </View>
          <View style={wc.info}>
            <View style={[wc.tag, selected && wc.tagAccent]}>
              <Text style={[wc.tagTxt, selected && { color: Colors.accent }]}>
                {displayCategory(item.category)}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Empty State (Premium UI) ─────────────────────────────────────────────────
function EmptyState({ onUpload }: { onUpload: () => void }) {
  const floatY = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, { toValue: -8, duration: 2000, useNativeDriver: true }),
        Animated.timing(floatY, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={es.wrap}>
      <Animated.Text style={[es.emoji, { transform: [{ translateY: floatY }] }]}>
        👔
      </Animated.Text>
      <Text style={es.title}>Your wardrobe is empty</Text>
      <Text style={es.sub}>
        Upload your first clothing item to{"\n"}start getting AI-powered outfit recommendations
      </Text>
      <TouchableOpacity onPress={onUpload} style={es.btnWrap} activeOpacity={0.88}>
        <LinearGradient
          colors={[Colors.accent, "#B84A00"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={es.btn}
        >
          <Text style={es.btnTxt}>+ Add First Item</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function WardrobeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useUser();

  // ── State (all logic from code 2) ─────────────────────────────────────────
  const [serverBase, setServerBase] = useState<string>(SERVER_BASE);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [tempServerBase, setTempServerBase] = useState<string>(SERVER_BASE);

  const [showModePicker, setShowModePicker] = useState(false);
  const modeResolveRef = useRef<((v: boolean) => void) | null>(null);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // Premium UI extras
  const [activeCategory, setActiveCategory] = useState(0);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [uploadStep, setUploadStep] = useState(0);

  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [todayOutfit, setTodayOutfit] = useState<GeneratedOutfit | null>(null);

  const userId = user?.id || "default_user";
  const userAvatar =
    (user?.unsafeMetadata as { profileImageUrl?: string })?.profileImageUrl ||
    user?.imageUrl ||
    "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&q=80";

  // ── Fetch wardrobe (logic from code 2) ────────────────────────────────────
  const fetchWardrobe = useCallback(async () => {
    setIsLoading(true);
    try {
      const resp = await fetch(
        `${serverBase}/api/profile/wardrobe/${encodeURIComponent(userId)}`
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

  // ── Today's outfit (logic from code 2) ───────────────────────────────────
  useEffect(() => {
    if (items.length === 0) {
      getOrCreateDailyOutfit(FALLBACK_WARDROBE).then(setTodayOutfit).catch(() => {});
      return;
    }
    getOrCreateDailyOutfit(buildWardrobeFromItems(items)).then(setTodayOutfit).catch(() => {});
  }, [items]);

  // ── Categories + filter (merged) ─────────────────────────────────────────
  const categories = useMemo(() => {
    const unique = Array.from(new Set(items.map((i) => i.category))).sort();
    return ["All", ...unique.map(displayCategory)];
  }, [items]);

  const filtered = useMemo(() => {
    let base =
      activeCategory === 0
        ? items
        : items.filter((i) => displayCategory(i.category) === categories[activeCategory]);
    if (searchText.trim())
      base = base.filter((i) =>
        displayCategory(i.category).toLowerCase().includes(searchText.toLowerCase())
      );
    return base;
  }, [items, activeCategory, categories, searchText]);

  const leftCol = filtered.filter((_, i) => i % 2 === 0);
  const rightCol = filtered.filter((_, i) => i % 2 !== 0);

  // ── Selection helpers (logic from code 2) ─────────────────────────────────
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

  // ── Delete selected (logic from code 2) ───────────────────────────────────
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
            console.log(`[Wardrobe] Deleting ${selectedIds.size} items...`);
            try {
              await Promise.all(
                Array.from(selectedIds).map(async (id) => {
                  const url = `${serverBase}/api/profile/wardrobe/${encodeURIComponent(userId)}/item/${encodeURIComponent(id)}`;
                  console.log(`[Wardrobe] DELETE request to: ${url}`);
                  try {
                    const res = await fetch(url, { method: "DELETE" });
                    if (!res.ok) {
                      const errData = await res.json().catch(() => ({}));
                      throw new Error(
                        errData.error || `Failed to delete item ${id} (Status: ${res.status})`
                      );
                    }
                    return id;
                  } catch (e) {
                    console.warn(`[Wardrobe] Delete ${id} failed:`, e);
                    throw e;
                  }
                })
              );
              setItems((prev) => prev.filter((item) => !selectedIds.has(item.id)));
              exitSelectionMode();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (err: any) {
              Alert.alert("Delete Failed", err.message || "Could not delete one or more items.");
              fetchWardrobe();
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  // ── Mode picker (logic from code 2) ───────────────────────────────────────
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

  // ── Upload (logic from code 2, progress from code 1) ─────────────────────
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

    const chosenAI = await askUploadMode();
    const asset = result.assets[0];
    setIsUploading(true);
    setUploadStep(10);
    setUploadProgress(
      chosenAI ? "Uploading · AI mannequin mode (~60s)…" : "Uploading · Fast mode…"
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
      formData.append("use_imagen", chosenAI ? "true" : "false");

      const fetchWithTimeout = (url: string, options: any, timeoutMs = 30000) =>
        Promise.race([
          fetch(url, options),
          new Promise<Response>((_, reject) =>
            setTimeout(() => reject(new Error("Upload request timeout")), timeoutMs)
          ),
        ]);

      console.log(`[uploadToWardrobe] Starting upload to ${serverBase}/api/profile/upload-wardrobe`);
      setUploadStep(30);
      const uploadResp = await fetchWithTimeout(
        `${serverBase}/api/profile/upload-wardrobe`,
        { method: "POST", body: formData },
        30000
      );
      if (!uploadResp.ok) throw new Error(`Upload failed: ${uploadResp.status}`);
      const { job_id: jobId } = await uploadResp.json();
      if (!jobId) throw new Error("No job_id returned");

      setUploadStep(55);
      setUploadProgress(
        chosenAI ? "Generating AI mannequin images…" : "Detecting & segmenting items…"
      );

      let attempts = 0;
      const poll = async (): Promise<void> => {
        attempts++;
        try {
          const statusResp = await fetchWithTimeout(
            `${serverBase}/api/profile/job/${encodeURIComponent(jobId)}`,
            {},
            15000
          );
          const statusJson = await statusResp.json();
          if (statusJson.status === "completed") {
            setUploadStep(100);
            const added = statusJson.results?.items_added || 0;
            const isDup = statusJson.results?.all_duplicates;
            const ai = statusJson.results?.items_imagen3 || 0;
            setUploadProgress("");
            setIsUploading(false);
            setUploadStep(0);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert(
              isDup ? "Already in wardrobe" : "Done! ✓",
              isDup
                ? "These items are already in your wardrobe."
                : chosenAI
                ? `${added} item(s) added with AI mannequin images (${ai} generated).`
                : `${added} item(s) added in fast mode.`
            );
            fetchWardrobe();
            return;
          }
          if (statusJson.status === "error")
            throw new Error(statusJson.error || "Processing failed");
          if (attempts >= 120) throw new Error("Processing timed out");
          setUploadStep(Math.min(90, 55 + attempts * 0.5));
          await new Promise((r) => setTimeout(r, 1000));
          return poll();
        } catch (err: any) {
          if (attempts >= 120) throw err;
          console.warn(`[poll attempt ${attempts}] Error:`, err.message);
          await new Promise((r) => setTimeout(r, 1000));
          return poll();
        }
      };
      await poll();
    } catch (err: any) {
      console.error("upload error:", err);
      Alert.alert("Error", err.message || "Failed to process image");
      setIsUploading(false);
      setUploadProgress("");
      setUploadStep(0);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={[S.root, { paddingTop: insets.top }]}>
      {/* ── Header (premium UI) ── */}
      <View style={S.header}>
        <View style={S.headerRow}>
          <View style={S.headerLeft}>
            {selectionMode ? (
              <TouchableOpacity onPress={exitSelectionMode} style={S.cancelBtn}>
                <Text style={S.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
            ) : (
              <>
                <Image source={{ uri: userAvatar }} style={S.avatar} />
                <View>
                  <Text style={S.headerTitle}>Virtual Wardrobe</Text>
                  <Text style={S.headerSub}>FITSENSE AI</Text>
                </View>
              </>
            )}
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {selectionMode ? (
              <>
                <TouchableOpacity onPress={selectAll} style={S.headerBtn}>
                  <Text style={S.headerBtnTxt}>All</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={deleteSelected}
                  disabled={selectedIds.size === 0 || isDeleting}
                  style={[
                    S.headerBtn,
                    S.headerBtnDanger,
                    selectedIds.size === 0 && { opacity: 0.4 },
                  ]}
                >
                  {isDeleting ? (
                    <ActivityIndicator size="small" color="#FF4D4D" />
                  ) : (
                    <Text style={S.headerBtnDangerTxt}>
                      Delete {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                onPress={() => {
                  setTempServerBase(serverBase);
                  setIsConfigOpen(true);
                }}
                style={S.iconBtn}
              >
                <Text style={{ color: Colors.textMuted, fontSize: 12, fontWeight: "700" }}>
                  IP
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Search Bar */}
        {!selectionMode && (
          <View style={[S.searchBar, searchFocused && S.searchBarFocused]}>
            <Text style={{ color: Colors.textSub, fontSize: 16 }}>⌕</Text>
            <TextInput
              style={S.searchInput}
              placeholder="Search wardrobe..."
              placeholderTextColor={Colors.textSub}
              value={searchText}
              onChangeText={setSearchText}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => setSearchText("")}>
                <Text style={{ color: Colors.textSub, fontSize: 14 }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Category Tabs */}
        {selectionMode ? (
          <View style={S.selBar}>
            <Text style={S.selTxt}>
              {selectedIds.size === 0
                ? "Tap items to select"
                : `${selectedIds.size} item${selectedIds.size > 1 ? "s" : ""} selected`}
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={S.catRow}
          >
            {categories.map((cat, i) => (
              <TouchableOpacity
                key={cat}
                onPress={() => {
                  Haptics.selectionAsync();
                  setActiveCategory(i);
                }}
                style={[S.catChip, activeCategory === i && S.catChipActive]}
              >
                {activeCategory === i && (
                  <LinearGradient
                    colors={["rgba(232,98,10,0.2)", "rgba(232,98,10,0.06)"]}
                    style={StyleSheet.absoluteFill}
                  />
                )}
                <Text style={[S.catTxt, activeCategory === i && S.catTxtActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Filter Chips */}
        {!selectionMode && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={S.filterRow}
          >
            {FILTER_CHIPS.map((f) => (
              <TouchableOpacity
                key={f}
                onPress={() => setActiveFilter(activeFilter === f ? null : f)}
                style={[S.filterChip, activeFilter === f && S.filterChipActive]}
              >
                <Text style={[S.filterTxt, activeFilter === f && { color: Colors.accent }]}>
                  {f}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* ── Grid ── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={S.scrollContent}
      >
        {isLoading ? (
          <WardrobeSkeletonGrid count={6} />
        ) : items.length === 0 ? (
          <EmptyState onUpload={uploadToWardrobe} />
        ) : filtered.length === 0 ? (
          <View style={S.emptyFilter}>
            <Text style={S.emptyFilterIcon}>🔍</Text>
            <Text style={S.emptyFilterTxt}>No items found</Text>
          </View>
        ) : (
          <>
            {!selectionMode && (
              <Text style={S.hintTxt}>
                {filtered.length} item{filtered.length !== 1 ? "s" : ""} · Long press to select
              </Text>
            )}
            <View style={S.grid}>
              <View style={S.col}>
                {leftCol.map((item, i) => (
                  <WardrobeCard
                    key={item.id}
                    item={item}
                    index={i * 2}
                    selectionMode={selectionMode}
                    selected={selectedIds.has(item.id)}
                    onLongPress={() => enterSelectionMode(item.id)}
                    onPress={() => {
                      if (selectionMode) toggleSelection(item.id);
                    }}
                  />
                ))}
              </View>
              <View style={[S.col, { marginTop: 0 }]}>
                {rightCol.map((item, i) => (
                  <WardrobeCard
                    key={item.id}
                    item={item}
                    index={i * 2 + 1}
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
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── FAB (premium UI with progress bar) ── */}
      {!selectionMode && (
        <View style={S.fabWrap}>
          {isUploading ? (
            <View style={{ alignItems: "center", gap: 10 }}>
              {uploadProgress ? (
                <View style={S.progressWrap}>
                  <LinearGradient
                    colors={["#1A1A1A", "#111"]}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={S.progressBar}>
                    <LinearGradient
                      colors={[Colors.accent, "#B84A00"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[S.progressFill, { width: `${uploadStep}%` as any }]}
                    />
                  </View>
                  <Text style={S.progressTxt} numberOfLines={1}>
                    {uploadProgress}
                  </Text>
                </View>
              ) : null}
              <View style={[S.fab, S.fabLoading]}>
                <ActivityIndicator size="small" color={Colors.accent} />
              </View>
            </View>
          ) : (
            <TouchableOpacity
              onPress={uploadToWardrobe}
              activeOpacity={0.88}
              style={S.fabTouch}
            >
              <LinearGradient
                colors={[Colors.accent, "#B84A00"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={S.fab}
              >
                <Text style={S.fabIcon}>+</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Upload Mode Picker (premium UI) ── */}
      {showModePicker && (
        <View style={S.sheetOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => confirmMode(false)}
          />
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={S.modeSheet}>
            <View style={S.sheetHandle} />
            <Text style={S.sheetTitle}>How should we process your outfit?</Text>
            <Text style={S.sheetSub}>Choose a mode. You can pick differently each time.</Text>

            <TouchableOpacity
              style={S.modeCard}
              onPress={() => confirmMode(false)}
              activeOpacity={0.85}
            >
              <View style={S.modeTop}>
                <View style={[S.modeIcon, { backgroundColor: "rgba(255,255,255,0.08)" }]}>
                  <Text style={S.modeIconTxt}>⚡</Text>
                </View>
                <View style={S.modeBadge}>
                  <Text style={S.modeBadgeTxt}>~15 sec</Text>
                </View>
              </View>
              <Text style={S.modeTitle}>Fast Mode</Text>
              <Text style={S.modeDesc}>
                Detects and saves items instantly. No AI generation — your actual clothing image
                is used directly.
              </Text>
              <View style={S.modePros}>
                {["✓ Instant results", "✓ Uses real photo", "✓ No extra cost"].map((p) => (
                  <Text key={p} style={S.modePro}>
                    {p}
                  </Text>
                ))}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[S.modeCard, S.modeCardAI]}
              onPress={() => confirmMode(true)}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={["rgba(232,98,10,0.1)", "transparent"]}
                style={StyleSheet.absoluteFill}
              />
              <View style={S.modeTop}>
                <View style={[S.modeIcon, { backgroundColor: "rgba(232,98,10,0.15)" }]}>
                  <Text style={S.modeIconTxt}>✦</Text>
                </View>
                <View style={[S.modeBadge, { backgroundColor: "rgba(232,98,10,0.18)" }]}>
                  <Text style={[S.modeBadgeTxt, { color: Colors.accent }]}>~60 sec</Text>
                </View>
              </View>
              <Text style={[S.modeTitle, { color: Colors.accent }]}>AI Mannequin</Text>
              <Text style={S.modeDesc}>
                Gemini Vision analyses your clothing then Imagen3 generates a professional
                product photo on a clean white mannequin.
              </Text>
              <View style={S.modePros}>
                {[
                  "✦ Studio-quality photo",
                  "✦ Clean white background",
                  "✦ Consistent wardrobe look",
                ].map((p) => (
                  <Text key={p} style={[S.modePro, { color: "rgba(232,98,10,0.85)" }]}>
                    {p}
                  </Text>
                ))}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={S.sheetCancel}
              onPress={() => {
                setShowModePicker(false);
                modeResolveRef.current?.(false);
                modeResolveRef.current = null;
              }}
            >
              <Text style={S.sheetCancelTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── IP Config ── */}
      {isConfigOpen && (
        <View style={S.ipOverlay}>
          <View style={S.overlayCard}>
            <Text style={S.overlayTitle}>Set Server IP</Text>
            <Text style={S.overlaySub}>
              Enter the base URL of your laptop (e.g. http://192.168.0.10:4000).
            </Text>
            <TextInput
              style={S.overlayInput}
              placeholder="http://192.168.x.x:4000"
              placeholderTextColor="rgba(255,255,255,0.4)"
              autoCapitalize="none"
              autoCorrect={false}
              value={tempServerBase}
              onChangeText={setTempServerBase}
            />
            <View style={S.overlayBtns}>
              <TouchableOpacity
                onPress={() => setIsConfigOpen(false)}
                style={S.overlayCancelBtn}
              >
                <Text style={S.overlayCancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  const trimmed = tempServerBase.trim();
                  if (!trimmed) return;
                  setServerBase(trimmed);
                  await AsyncStorage.setItem(API_BASE_STORAGE_KEY, trimmed).catch(() => {});
                  setIsConfigOpen(false);
                }}
                style={S.overlaySaveBtn}
              >
                <LinearGradient
                  colors={[Colors.accent, "#B84A00"]}
                  style={S.overlaySaveGrad}
                >
                  <Text style={S.overlaySaveTxt}>Save</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  header: {
    backgroundColor: "rgba(8,8,8,0.97)",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: `${Colors.accent}44`,
  },
  headerTitle: { color: Colors.text, fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  headerSub: { color: Colors.accent, fontSize: 9, fontWeight: "700", letterSpacing: 1.8 },

  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface3,
  },
  cancelTxt: { color: Colors.text, fontSize: 13, fontWeight: "600" },
  headerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface3,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  headerBtnTxt: { color: Colors.textMuted, fontSize: 12, fontWeight: "600" },
  headerBtnDanger: {
    backgroundColor: "rgba(255,77,77,0.15)",
    borderColor: "rgba(255,77,77,0.3)",
  },
  headerBtnDangerTxt: { color: "#FF4D4D", fontSize: 12, fontWeight: "600" },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.surface3,
    borderWidth: 1,
    borderColor: Colors.border2,
    alignItems: "center",
    justifyContent: "center",
  },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 42,
    backgroundColor: Colors.surface2,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    marginBottom: Spacing.md,
  },
  searchBarFocused: { borderColor: `${Colors.accent}55` },
  searchInput: { flex: 1, color: Colors.text, fontSize: 14 },

  catRow: { gap: 8, paddingBottom: Spacing.sm, paddingRight: Spacing.lg },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  catChipActive: { borderColor: `${Colors.accent}55` },
  catTxt: { color: Colors.textMuted, fontSize: 13, fontWeight: "600" },
  catTxtActive: { color: Colors.accent },

  filterRow: { gap: 8, paddingBottom: Spacing.md, paddingRight: Spacing.lg },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface2,
  },
  filterChipActive: {
    borderColor: `${Colors.accent}44`,
    backgroundColor: "rgba(232,98,10,0.08)",
  },
  filterTxt: { color: Colors.textSub, fontSize: 11, fontWeight: "600" },

  selBar: { paddingVertical: Spacing.sm, paddingBottom: Spacing.md },
  selTxt: { color: Colors.textMuted, fontSize: 13, fontWeight: "600" },

  scrollContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },
  hintTxt: { color: Colors.textSub, fontSize: 11, marginBottom: Spacing.md },
  grid: { flexDirection: "row", gap: Spacing.sm },
  col: { flex: 1, gap: Spacing.sm },

  emptyFilter: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyFilterIcon: { fontSize: 48 },
  emptyFilterTxt: { color: Colors.textMuted, fontSize: 16, fontWeight: "600" },

  fabWrap: {
    position: "absolute",
    bottom: 30,
    right: Spacing.lg,
    alignItems: "flex-end",
    gap: 10,
  },
  fabTouch: { borderRadius: 30, overflow: "hidden", ...Shadows.accentLg },
  fab: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  fabLoading: {
    backgroundColor: Colors.surface3,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  fabIcon: { color: "#fff", fontSize: 28, fontWeight: "300", lineHeight: 30, marginTop: -2 },

  progressWrap: {
    borderRadius: Radius.lg,
    overflow: "hidden",
    width: 220,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.surface3,
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: { height: 4, borderRadius: 2 },
  progressTxt: { color: Colors.textMuted, fontSize: 11, fontWeight: "500" },

  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    justifyContent: "flex-end",
  },
  modeSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    padding: Spacing.xl,
    paddingBottom: 40,
    gap: Spacing.md,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.surface4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: Spacing.sm,
  },
  sheetTitle: { color: Colors.text, fontSize: 20, fontWeight: "800", letterSpacing: -0.3 },
  sheetSub: { color: Colors.textMuted, fontSize: 13 },

  modeCard: {
    backgroundColor: Colors.surface2,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
    gap: 8,
  },
  modeCardAI: { borderColor: `${Colors.accent}33` },
  modeTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modeIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  modeIconTxt: { fontSize: 18 },
  modeBadge: {
    backgroundColor: Colors.surface3,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  modeBadgeTxt: { color: Colors.textMuted, fontSize: 11, fontWeight: "700" },
  modeTitle: { color: Colors.text, fontSize: 17, fontWeight: "800" },
  modeDesc: { color: Colors.textMuted, fontSize: 13, lineHeight: 20 },
  modePros: { gap: 4 },
  modePro: { color: Colors.textSub, fontSize: 12 },

  sheetCancel: {
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sheetCancelTxt: { color: Colors.textMuted, fontSize: 15, fontWeight: "600" },

  ipOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
    backgroundColor: "rgba(0,0,0,0.85)",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
  },
  overlayCard: {
    backgroundColor: Colors.surface2,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    width: "100%",
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  overlayTitle: { color: Colors.text, fontSize: 18, fontWeight: "800" },
  overlaySub: { color: Colors.textMuted, fontSize: 13, lineHeight: 20 },
  overlayInput: {
    backgroundColor: Colors.surface3,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  overlayBtns: { flexDirection: "row", gap: Spacing.sm },
  overlayCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border2,
    alignItems: "center",
  },
  overlayCancelTxt: { color: Colors.textMuted, fontSize: 14, fontWeight: "600" },
  overlaySaveBtn: { flex: 1, borderRadius: Radius.lg, overflow: "hidden" },
  overlaySaveGrad: { paddingVertical: 12, alignItems: "center" },
  overlaySaveTxt: { color: "#fff", fontSize: 14, fontWeight: "700" },
});

const wc = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface2,
    borderRadius: Radius.lg,
    padding: 6,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  cardSelected: { borderColor: `${Colors.accent}66` },
  imgWrap: { borderRadius: Radius.md, overflow: "hidden", aspectRatio: 0.8 },
  img: { width: "100%", height: "100%" },
  dim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
  checkWrap: { position: "absolute", top: 8, right: 8 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  checkActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  checkTxt: { color: "#fff", fontSize: 12, fontWeight: "800" },
  info: { paddingTop: 8, paddingHorizontal: 4 },
  tag: {
    alignSelf: "flex-start",
    backgroundColor: Colors.surface3,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tagAccent: {
    backgroundColor: "rgba(232,98,10,0.1)",
    borderColor: `${Colors.accent}44`,
  },
  tagTxt: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: "600",
    textTransform: "capitalize",
  },
});

const es = StyleSheet.create({
  wrap: { alignItems: "center", paddingTop: 80, paddingHorizontal: 40, gap: 16 },
  emoji: { fontSize: 72 },
  title: { color: Colors.text, fontSize: 20, fontWeight: "800", textAlign: "center" },
  sub: { color: Colors.textMuted, fontSize: 14, textAlign: "center", lineHeight: 22 },
  btnWrap: { width: "100%", borderRadius: Radius.full, overflow: "hidden", marginTop: 8 },
  btn: { paddingVertical: 16, alignItems: "center" },
  btnTxt: { color: "#fff", fontSize: 16, fontWeight: "700" },
});