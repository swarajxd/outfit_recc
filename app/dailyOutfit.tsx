import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
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

const COLUMN_GAP = 12;

function capitalise(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

// ─── Card component: measures its own width via onLayout to set image height ─
function WardrobeCard({
  item,
  isSelected,
  onPress,
  isLeft,
}: {
  item: any;
  isSelected: boolean;
  onPress: () => void;
  isLeft: boolean;
}) {
  const [imgHeight, setImgHeight] = useState(0);
  const hasValidImage = item?.image && typeof item.image === "string" && item.image.length > 4;

  return (
    <TouchableOpacity
      style={[styles.itemCard, isLeft && { marginRight: COLUMN_GAP }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* onLayout on this View gives us the actual rendered card width */}
      <View
        style={styles.imageWrap}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0) setImgHeight((w * 4) / 3);
        }}
      >
        <View style={[styles.imageInner, imgHeight > 0 && { height: imgHeight }]}>
          {hasValidImage ? (
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
      </View>

      <View style={styles.itemMeta}>
        <Text
          style={[styles.itemCategory, isSelected && styles.itemCategorySelected]}
          numberOfLines={1}
        >
          {item.category?.toUpperCase()}
        </Text>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.name
            ? capitalise(item.name)
            : item.filename
            ? item.filename.replace(/\.[^/.]+$/, "")
            : capitalise(item.category)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function DailyOutfit() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { wardrobe, day, date } = useLocalSearchParams();

  const rawItems: any[] = useMemo(() => {
    if (!wardrobe) return [];
    try { return JSON.parse(wardrobe as string); } catch { return []; }
  }, [wardrobe]);

  const categories = useMemo(() => {
    const seen = new Set<string>();
    rawItems.forEach((i) => seen.add(i.category));
    return ["All", ...Array.from(seen).sort()];
  }, [rawItems]);

  const [activeCategory, setActiveCategory] = useState("All");
  const [selected, setSelected] = useState<Record<string, any>>({});

  const filteredItems = useMemo(() =>
    activeCategory === "All" ? rawItems : rawItems.filter((i) => i.category === activeCategory),
    [rawItems, activeCategory]
  );

  const selectItem = (item: any) => {
    setSelected((prev) => {
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
    try {
      await AsyncStorage.setItem(key, JSON.stringify({ ...selected, date, day }));
      router.back();
    } catch (e) { console.log("Error saving outfit", e); }
  };

  const selectedCount = Object.keys(selected).length;
  const BOTTOM_BAR_HEIGHT = 80 + Math.max(insets.bottom, 16);

  return (
    <View style={[styles.container, { paddingTop: insets.top || 52 }]}>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <View style={styles.hero}>
        <Text style={styles.overline}>VAULT COLLECTION</Text>
        <Text style={styles.heroTitle}>Wardrobe</Text>
        <Text style={styles.heroSub}>{day}{"  "}·{"  "}{date}</Text>
      </View>

      {/* ── FILTER PILLS ──────────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterBar}
      >
        {categories.map((cat, idx) => {
          const isActive = activeCategory === cat;
          return (
            <TouchableOpacity
              key={cat}
              onPress={() => setActiveCategory(cat)}
              activeOpacity={0.8}
              style={[
                styles.filterPill,
                isActive && styles.filterPillActive,
                idx < categories.length - 1 && { marginRight: 8 },
              ]}
            >
              <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                {capitalise(cat)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── GRID ──────────────────────────────────────────────────────────── */}
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.gridContent}>
          {chunkArray(filteredItems, 2).map((row, rowIndex) => (
            <View key={rowIndex} style={styles.row}>
              {row.map((item: any, colIndex: number) => (
                <WardrobeCard
                  key={item.id ?? `${rowIndex}-${colIndex}`}
                  item={item}
                  isSelected={selected[item.category]?.id === item.id}
                  onPress={() => selectItem(item)}
                  isLeft={colIndex === 0}
                />
              ))}
              {/* Placeholder so a lone card stays left-aligned */}
              {row.length === 1 && <View style={styles.itemCard} />}
            </View>
          ))}
          <View style={{ height: BOTTOM_BAR_HEIGHT + 24 }} />
        </View>
      </ScrollView>

      {/* ── BOTTOM BAR ────────────────────────────────────────────────────── */}
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
  container: { flex: 1, backgroundColor: SURFACE },

  hero: { paddingHorizontal: 24, paddingBottom: 16 },
  overline: { color: PRIMARY, fontSize: 10, fontWeight: "700", letterSpacing: 4, marginBottom: 8 },
  heroTitle: { fontSize: 52, fontWeight: "300", color: ON_SURFACE, letterSpacing: -2, lineHeight: 56, marginBottom: 4 },
  heroSub: { color: ON_SURFACE_DIM, fontSize: 13, letterSpacing: 0.5 },

  filterBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 16 },
  filterPill: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 999, backgroundColor: SURFACE_LOW },
  filterPillActive: { backgroundColor: ON_SURFACE },
  filterText: { color: ON_SURFACE_DIM, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.5 },
  filterTextActive: { color: SURFACE },

  // Grid: rows with two flex:1 cards — no pixel widths anywhere
  gridContent: { paddingHorizontal: 16 },
  row: { flexDirection: "row", marginBottom: COLUMN_GAP },

  // KEY FIX: flex: 1 makes each card take exactly half the row width,
  // no matter what the screen size or platform.
  itemCard: {
    flex: 1,
    backgroundColor: SURFACE_LOW,
    borderRadius: 20,
    overflow: "hidden",
  },

  // imageWrap fills the card width (flex:1), onLayout reads the actual px
  imageWrap: { width: "100%" },
  // imageInner starts at 0 height; set to (width * 4/3) after onLayout fires
  imageInner: {
    width: "100%",
    height: 180, // sensible default until onLayout fires (usually < 1 frame)
    backgroundColor: SURFACE_LOWEST,
    overflow: "hidden",
    position: "relative",
  },
  emojiWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  emoji: { fontSize: 44 },

  checkWrapper: { position: "absolute", top: 10, right: 10, zIndex: 10 },
  checkCircleFilled: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  checkMark: { color: "#fff", fontSize: 14, fontWeight: "700" },
  checkCircleGhost: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: "rgba(255,255,255,0.3)", backgroundColor: "rgba(0,0,0,0.25)" },

  itemMeta: { padding: 12, paddingTop: 10 },
  itemCategory: { color: ON_SURFACE_DIM, fontSize: 9, fontWeight: "700", letterSpacing: 2, marginBottom: 3 },
  itemCategorySelected: { color: PRIMARY },
  itemName: { color: ON_SURFACE, fontSize: 13, fontWeight: "500" },

  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 12, backgroundColor: "rgba(19,19,19,0.92)" },
  bottomInner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(31,31,31,0.8)", borderRadius: 999, paddingLeft: 24, paddingRight: 5, paddingVertical: 5 },
  countBlock: { paddingVertical: 8 },
  countLabel: { color: ON_SURFACE_DIM, fontSize: 9, fontWeight: "700", letterSpacing: 2 },
  countValue: { color: ON_SURFACE, fontSize: 18, fontWeight: "700", lineHeight: 22 },
  saveBtn: { paddingHorizontal: 28, paddingVertical: 16, borderRadius: 999 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 13, letterSpacing: 1.5, textTransform: "uppercase" },
});