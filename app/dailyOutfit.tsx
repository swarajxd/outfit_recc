import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Design Tokens ───────────────────────────────────────────────────────────
const SURFACE = "#131313";
const SURFACE_LOW = "#1B1B1B";
const SURFACE_LOWEST = "#0E0E0E";
const PRIMARY = "#FF4500";
const PRIMARY_CONTAINER = "#FF5625";
const PRIMARY_LIGHT = "#FFB5A0";
const ON_SURFACE = "#E2E2E2";
const ON_SURFACE_DIM = "rgba(226,226,226,0.4)";

// Card width = 47% of screen minus padding
const CARD_WIDTH = (Dimensions.get("window").width - 32 - 12) / 2;
const CARD_IMAGE_HEIGHT = (CARD_WIDTH * 4) / 3;

function capitalise(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export default function DailyOutfit() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { wardrobe, day, date } = useLocalSearchParams();

  // ── Parse the raw items array sent from home.tsx ─────────────────────────
  // Each item: { id, image, category, filename? }
  const rawItems: any[] = useMemo(() => {
    if (!wardrobe) return [];
    try {
      return JSON.parse(wardrobe as string);
    } catch {
      return [];
    }
  }, [wardrobe]);

  // ── Build category filter list from actual items ──────────────────────────
  const categories = useMemo(() => {
    const seen = new Set<string>();
    rawItems.forEach((i) => seen.add(i.category));
    return ["All", ...Array.from(seen).sort()];
  }, [rawItems]);

  const [activeCategory, setActiveCategory] = useState("All");

  // ── Selected map: category → chosen item ─────────────────────────────────
  const [selected, setSelected] = useState<Record<string, any>>({});

  const filteredItems = useMemo(() => {
    if (activeCategory === "All") return rawItems;
    return rawItems.filter((i) => i.category === activeCategory);
  }, [rawItems, activeCategory]);

  const selectItem = (item: any) => {
    setSelected((prev) => {
      // Toggle off if same item tapped again
      if (prev[item.category]?.id === item.id) {
        const next = { ...prev };
        delete next[item.category];
        return next;
      }
      return { ...prev, [item.category]: item };
    });
  };

  const saveOutfit = async () => {
    const key = `fitsense_outfit_${day}_${date}`;
    const outfitData = { ...selected, date, day };
    try {
      await AsyncStorage.setItem(key, JSON.stringify(outfitData));
      router.back();
    } catch (e) {
      console.log("Error saving outfit", e);
    }
  };

  const selectedCount = Object.keys(selected).length;

  const hasValidImage = (img: any) =>
    img && typeof img === "string" && img.length > 4;

  return (
    <View style={[styles.container, { paddingTop: insets.top || 52 }]}>
      {/* ── HERO HEADER ─────────────────────────────────────────────────── */}
      <View style={styles.hero}>
        <Text style={styles.overline}>VAULT COLLECTION</Text>
        <Text style={styles.heroTitle}>Wardrobe</Text>
        <Text style={styles.heroSub}>
          {day}{"  "}·{"  "}{date}
        </Text>
      </View>

      {/* ── CATEGORY FILTER PILLS ────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterBar}
      >
        {categories.map((cat) => {
          const isActive = activeCategory === cat;
          return (
            <TouchableOpacity
              key={cat}
              onPress={() => setActiveCategory(cat)}
              activeOpacity={0.8}
              style={[styles.filterPill, isActive && styles.filterPillActive]}
            >
              <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                {capitalise(cat)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── WARDROBE GRID ────────────────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.gridContent}
      >
        <View style={styles.grid}>
          {filteredItems.map((item: any, i: number) => {
            const isSelected = selected[item.category]?.id === item.id;

            return (
              <TouchableOpacity
                key={item.id ?? i}
                style={styles.itemCard}
                onPress={() => selectItem(item)}
                activeOpacity={0.85}
              >
                {/* ── Image area ─────────────────────────────────────── */}
                <View style={styles.imageWrap}>
                  {hasValidImage(item.image) ? (
                    <Image
                      source={{ uri: item.image }}
                      style={StyleSheet.absoluteFillObject}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.emojiWrap}>
                      <Text style={styles.emoji}>👕</Text>
                    </View>
                  )}

                  {/* ── Selection circle (top-right) ─────────────────── */}
                  <View style={styles.checkWrapper}>
                    {isSelected ? (
                      <LinearGradient
                        colors={[PRIMARY_CONTAINER, PRIMARY]}
                        style={styles.checkCircleFilled}
                      >
                        <Text style={styles.checkMark}>✓</Text>
                      </LinearGradient>
                    ) : (
                      <View style={styles.checkCircleGhost} />
                    )}
                  </View>
                </View>

                {/* ── Label below ────────────────────────────────────── */}
                <View style={styles.itemMeta}>
                  <Text
                    style={[
                      styles.itemCategory,
                      isSelected && styles.itemCategorySelected,
                    ]}
                    numberOfLines={1}
                  >
                    {item.category?.toUpperCase()}
                  </Text>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {capitalise(item.category)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: 140 }} />
      </ScrollView>

      {/* ── GLASSMORPHISM BOTTOM BAR ─────────────────────────────────────── */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.bottomInner}>
          <View style={styles.countBlock}>
            <Text style={styles.countLabel}>SELECTED</Text>
            <Text style={styles.countValue}>{selectedCount} Items</Text>
          </View>
          <TouchableOpacity onPress={saveOutfit} activeOpacity={0.85}>
            <LinearGradient
              colors={[PRIMARY_CONTAINER, PRIMARY_LIGHT]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.saveBtn}
            >
              <Text style={styles.saveBtnText}>Save Outfit</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SURFACE,
  },

  // Hero
  hero: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  overline: {
    color: PRIMARY,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 4,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 52,
    fontWeight: "200",
    color: ON_SURFACE,
    letterSpacing: -2,
    lineHeight: 56,
    marginBottom: 4,
  },
  heroSub: {
    color: ON_SURFACE_DIM,
    fontSize: 13,
    letterSpacing: 0.5,
  },

  // Filter pills
  filterBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: SURFACE_LOW,
  },
  filterPillActive: {
    backgroundColor: ON_SURFACE,
  },
  filterText: {
    color: ON_SURFACE_DIM,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  filterTextActive: {
    color: SURFACE,
  },

  // Grid
  gridContent: {
    paddingHorizontal: 16,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  itemCard: {
    width: CARD_WIDTH,
    backgroundColor: SURFACE_LOW,
    borderRadius: 20,
    overflow: "hidden",
  },
  imageWrap: {
    width: CARD_WIDTH,
    height: CARD_IMAGE_HEIGHT,
    backgroundColor: SURFACE_LOWEST,
    overflow: "hidden",
    position: "relative",
  },
  emojiWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: {
    fontSize: 44,
  },

  // Selection indicator
  checkWrapper: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 10,
  },
  checkCircleFilled: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  checkMark: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  checkCircleGhost: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
    backgroundColor: "rgba(0,0,0,0.25)",
  },

  // Item label
  itemMeta: {
    padding: 12,
    paddingTop: 10,
  },
  itemCategory: {
    color: ON_SURFACE_DIM,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 3,
  },
  itemCategorySelected: {
    color: PRIMARY,
  },
  itemName: {
    color: ON_SURFACE,
    fontSize: 13,
    fontWeight: "500",
  },

  // Bottom action bar
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: "rgba(19,19,19,0.92)",
  },
  bottomInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(31,31,31,0.8)",
    borderRadius: 999,
    paddingLeft: 24,
    paddingRight: 5,
    paddingVertical: 5,
  },
  countBlock: {
    paddingVertical: 8,
  },
  countLabel: {
    color: ON_SURFACE_DIM,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
  },
  countValue: {
    color: ON_SURFACE,
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 22,
  },
  saveBtn: {
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 999,
  },
  saveBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
});