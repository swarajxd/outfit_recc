import { useUser } from "@clerk/clerk-expo";
import React, { useEffect, useMemo, useState } from "react";
import {
    Dimensions,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";

const PRIMARY = "#FF6B00";
const BG = "#0a0806";
const CARD_DARK = "#1a140e";
const WIDTH = Dimensions.get("window").width;
const GAP = 10;
const COL_WIDTH = (WIDTH - 32 - GAP) / 2;
const DEFAULT_AVATAR =
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&q=80";

const CATEGORIES = [
  "For You",
  "Streetwear",
  "Minimalist",
  "Vintage",
  "Y2K",
  "Formal",
];

const GRID_ITEMS = [
  {
    id: "1",
    image:
      "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=400&q=80",
    match: 98,
    user: "@alex_fits",
    avatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=60&q=80",
    tall: true,
  },
  {
    id: "2",
    image:
      "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400&q=80",
    match: 92,
    tall: false,
  },
  {
    id: "3",
    image:
      "https://images.unsplash.com/photo-1550614000-4895a10e1bfd?w=400&q=80",
    match: 85,
    tall: false,
  },
  {
    id: "4",
    image:
      "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=400&q=80",
    match: 95,
    user: "@jordan_vibe",
    avatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60&q=80",
    tall: true,
  },
  {
    id: "5",
    image:
      "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400&q=80",
    match: 88,
    tall: false,
  },
  {
    id: "6",
    image:
      "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=400&q=80",
    match: 91,
    tall: false,
  },
];

type GridItem = {
  id: string;
  image: string;
  match: number;
  user?: string | null;
  avatar?: string | null;
  tall: boolean;
};

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const [activeCategory, setActiveCategory] = useState(0);
  const [gridItems, setGridItems] = useState<GridItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Get user avatar - prefer Cloudinary URL from metadata, fallback to Clerk imageUrl
  const userAvatar =
    (user?.unsafeMetadata as { profileImageUrl?: string })?.profileImageUrl ||
    user?.imageUrl ||
    DEFAULT_AVATAR;
  const username =
    (user as any)?.username ||
    user?.fullName ||
    (user?.unsafeMetadata as { name?: string } | undefined)?.name ||
    (user as any)?.primaryEmailAddress?.emailAddress ||
    "@you";

  useEffect(() => {
    let cancelled = false;
    async function fetchGridItems() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("posts")
          .select("id,image_url,owner_clerk_id,caption,created_at")
          .order("created_at", { ascending: false })
          .limit(10);

        if (error) throw error;

        if (cancelled) return;
        const mapped: GridItem[] = (data ?? []).map((p: any, i: number) => {
          const match = 92 - (i % 5); // keeps badge style but doesn't change layout
          return {
            id: String(p.id),
            image: String(p.image_url),
            match,
            user: p.owner_clerk_id ? String(p.owner_clerk_id) : null,
            avatar: userAvatar || DEFAULT_AVATAR,
            tall: i % 2 === 0,
          };
        });

        setGridItems(mapped);
      } catch (e) {
        console.error("explore fetchGridItems error", e);
        if (!cancelled) setGridItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchGridItems();
    return () => {
      cancelled = true;
    };
  }, [userAvatar]);

  const leftCol = useMemo(
    () => gridItems.filter((_, i) => i % 2 === 0),
    [gridItems],
  );
  const rightCol = useMemo(
    () => gridItems.filter((_, i) => i % 2 !== 0),
    [gridItems],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Explore</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconBtn}>
              <Text style={{ color: "#fff", fontSize: 18 }}>🔔</Text>
            </TouchableOpacity>
            <View style={styles.userPill}>
              <Image
                source={{
                  uri: userAvatar,
                }}
                style={styles.avatar}
              />
              <Text style={styles.userPillText} numberOfLines={1}>
                {String(username)}
              </Text>
            </View>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search styles, brands, or trends"
            placeholderTextColor="rgba(255,255,255,0.35)"
          />
        </View>

        {/* Category Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {CATEGORIES.map((cat, i) => (
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

      {/* Masonry Grid */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.gridContainer}
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Trending Now</Text>
          <TouchableOpacity>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.grid}>
          {/* Left Column */}
          <View style={[styles.column, { marginRight: GAP / 2 }]}>
            {loading ? (
              <View style={{ height: 180, justifyContent: "center", alignItems: "center" }}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : (
              leftCol.map((item) => <GridCard key={item.id} item={item} />)
            )}
          </View>
          {/* Right Column */}
          <View style={[styles.column, { marginLeft: GAP / 2 }]}>
            {!loading &&
              rightCol.map((item) => <GridCard key={item.id} item={item} />)}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function GridCard({ item }: { item: GridItem }) {
  const height = item.tall ? COL_WIDTH * 1.5 : COL_WIDTH * 0.85;
  return (
    <View style={[styles.gridCard, { height, marginBottom: GAP }]}>
      <Image source={{ uri: item.image }} style={styles.gridImage} />
      <View style={styles.gridOverlay} />

      {/* Match Badge */}
      <View style={styles.gridBadge}>
        <Text style={styles.gridBadgeText}>{item.match}% Match</Text>
      </View>

      {/* User (if present) */}
      {item.user && item.avatar && (
        <View style={styles.gridUser}>
          <Image source={{ uri: item.avatar }} style={styles.gridAvatar} />
          <Text style={styles.gridUserText}>{item.user}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    backgroundColor: "rgba(10,8,6,0.9)",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  userPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 10,
    paddingLeft: 2,
    height: 40,
    borderRadius: 999,
    backgroundColor: CARD_DARK,
  },
  userPillText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    maxWidth: 110,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: CARD_DARK,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: PRIMARY,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CARD_DARK,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
  },
  searchIcon: { color: "rgba(255,255,255,0.4)", fontSize: 18, marginRight: 8 },
  searchInput: { flex: 1, color: "#fff", fontSize: 14, padding: 0 },
  chipsRow: { paddingBottom: 10, gap: 8 },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: CARD_DARK,
  },
  chipActive: { backgroundColor: PRIMARY },
  chipText: { color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  gridContainer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: { color: "#fff", fontSize: 20, fontWeight: "800" },
  seeAll: { color: PRIMARY, fontSize: 13, fontWeight: "700" },
  grid: { flexDirection: "row" },
  column: { flex: 1 },
  gridCard: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: CARD_DARK,
    position: "relative",
  },
  gridImage: { width: "100%", height: "100%", resizeMode: "cover" },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
  },
  gridBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  gridBadgeText: { color: PRIMARY, fontSize: 10, fontWeight: "700" },
  gridUser: {
    position: "absolute",
    bottom: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  gridAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  gridUserText: { color: "#fff", fontSize: 11, fontWeight: "600" },
});
