import { useUser } from "@clerk/clerk-expo";
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from "../../lib/supabase";
import { SERVER_BASE } from "../utils/config";
import CommentModal from "../../components/CommentModal";

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

type ProfileLite = {
  clerk_id: string | null;
  username?: string | null;
  full_name?: string | null;
  profile_image_url?: string | null;
};

type GridItem = {
  id: string;
  image: string;
  username: string;
  avatar: string;
  tall: boolean;
  commentsCount: number;
  owner_clerk_id: string;
};

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState(0);
  const [gridItems, setGridItems] = useState<GridItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [peopleResults, setPeopleResults] = useState<ProfileLite[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [likedItems, setLikedItems] = useState<Record<string, boolean>>({});
  const [savedItems, setSavedItems] = useState<Record<string, boolean>>({});
  const [persistedDataLoaded, setPersistedDataLoaded] = useState(false);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  // Get user avatar
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

  // Load liked and saved items from AsyncStorage
  useEffect(() => {
    const loadPersistedData = async () => {
      if (!user?.id) {
        return;
      }
      try {
        const likedKey = `fitsense_liked_${user?.id}`;
        const savedKey = `fitsense_saved_${user?.id}`;
        const likedJson = await AsyncStorage.getItem(likedKey);
        const savedJson = await AsyncStorage.getItem(savedKey);
        if (likedJson) setLikedItems(JSON.parse(likedJson));
        if (savedJson) setSavedItems(JSON.parse(savedJson));
        setPersistedDataLoaded(true);
      } catch (e) {
        console.warn('Error loading persisted data:', e);
        setPersistedDataLoaded(true);
      }
    };
    loadPersistedData();
  }, [user?.id]);

  // Persist liked items
  useEffect(() => {
    if (!persistedDataLoaded) return;
    const persistLikedItems = async () => {
      try {
        await AsyncStorage.setItem(
          `fitsense_liked_${user?.id}`,
          JSON.stringify(likedItems)
        );
      } catch (e) {
        console.warn('Error saving liked items:', e);
      }
    };
    if (user?.id) persistLikedItems();
  }, [likedItems, user?.id, persistedDataLoaded]);

  // Persist saved items
  useEffect(() => {
    if (!persistedDataLoaded) return;
    const persistSavedItems = async () => {
      try {
        const key = `fitsense_saved_${user?.id}`;
        await AsyncStorage.setItem(key, JSON.stringify(savedItems));
      } catch (e) {
        console.warn('Error saving saved items:', e);
      }
    };
    if (user?.id) persistSavedItems();
  }, [savedItems, user?.id, persistedDataLoaded]);

  async function getAuthHeader(): Promise<string | null> {
    if (!user?.id) return null;
    return `Bearer dev:${user.id}`;
  }

  useEffect(() => {
    let cancelled = false;
    async function fetchGridItems() {
      try {
        setLoading(true);
        if (!user?.id) {
          setGridItems([]);
          return;
        }

        const authHeader = await getAuthHeader();
        if (!authHeader) {
          setGridItems([]);
          return;
        }

        const resp = await fetch(`${SERVER_BASE}/api/for-you`, {
          headers: { Authorization: authHeader },
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error((json as any)?.error || "Failed to load feed");

        const data = (json as any)?.posts ?? [];
        const mapped: GridItem[] = (data ?? []).map((p: any, i: number) => {
          const ownerProfile = p.owner_profile;
          const displayName = ownerProfile?.full_name || ownerProfile?.username || "Unknown";
          const avatar = ownerProfile?.profile_image_url || DEFAULT_AVATAR;

          return {
            id: String(p.id),
            image: String(p.image_url),
            username: displayName,
            avatar: avatar,
            tall: i % 2 === 0,
            commentsCount: p.comments_count ?? 0,
            owner_clerk_id: p.owner_clerk_id,
          };
        });

        if (!cancelled) setGridItems(mapped);
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
  }, [user?.id]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setPeopleResults([]);
      setPeopleLoading(false);
      return;
    }

    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        setPeopleLoading(true);
        const resp = await fetch(
          `${SERVER_BASE}/api/profile/search?query=${encodeURIComponent(q)}&limit=20`,
        );
        if (!resp.ok) throw new Error("search failed");
        const json = await resp.json();
        if (cancelled) return;
        setPeopleResults(Array.isArray(json.users) ? json.users : []);
      } catch (e) {
        console.warn("explore people search error:", e);
        if (!cancelled) setPeopleResults([]);
      } finally {
        if (!cancelled) setPeopleLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [searchQuery]);

  const openProfile = (clerkId: string) => {
    router.push({
      pathname: "/(tabs)/profile",
      params: { user_id: clerkId },
    });
  };

  const toggleLike = (id: string) => {
    setLikedItems((prev) => ({ ...prev, [id]: !prev[id] }));
    // Increment/decrement like count
    setLikeCounts((prev) => {
      const currentLikes = prev[id] ?? 0;
      const isCurrentlyLiked = likedItems[id] ?? false;
      return { ...prev, [id]: isCurrentlyLiked ? currentLikes - 1 : currentLikes + 1 };
    });
  };

  const toggleSave = (id: string) =>
    setSavedItems((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleCommentPress = (postId: string) => {
    setSelectedPostId(postId);
    setCommentModalVisible(true);
  };

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
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search people by name or username"
            placeholderTextColor="rgba(255,255,255,0.35)"
          />
        </View>

        {/* Category Chips */}
        {searchQuery.trim().length === 0 && (
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
        )}
      </View>

      {/* Results */}
      {searchQuery.trim().length > 0 ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.peopleContainer}
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>People</Text>
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Text style={styles.seeAll}>Clear</Text>
            </TouchableOpacity>
          </View>

          {peopleLoading ? (
            <View style={{ paddingVertical: 40, alignItems: "center" }}>
              <ActivityIndicator size="large" color={PRIMARY} />
            </View>
          ) : peopleResults.length === 0 ? (
            <View style={{ paddingVertical: 50, alignItems: "center" }}>
              <Text style={{ fontSize: 44 }}>🔎</Text>
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}>
                No people found
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, marginTop: 8, textAlign: "center", paddingHorizontal: 26 }}>
                Try searching by name or username.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 1 }}>
              {peopleResults.map((p, idx) => {
                const handle = p.username
                  ? p.username.startsWith("@")
                    ? p.username
                    : `@${p.username}`
                  : null;
                const title =
                  p.full_name || handle || p.clerk_id || `User #${idx + 1}`;
                const avatarUri = p.profile_image_url || DEFAULT_AVATAR;

                return (
                  <TouchableOpacity
                    key={String(p.clerk_id || idx)}
                    style={styles.personRow}
                    activeOpacity={0.85}
                    onPress={() => {
                      if (!p.clerk_id) return;
                      openProfile(String(p.clerk_id));
                    }}
                  >
                    <Image source={{ uri: avatarUri }} style={styles.personAvatar} />
                    <View style={styles.personTextBlock}>
                      <Text style={styles.personName} numberOfLines={1}>
                        {title}
                      </Text>
                      <Text style={styles.personHandle} numberOfLines={1}>
                        {handle || String(p.clerk_id || "")}
                      </Text>
                    </View>
                    <Text style={styles.personChevron}>›</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      ) : (
        // Masonry Grid
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.gridContainer}
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Explore Posts</Text>
          </View>

          {loading ? (
            <View style={{ height: 180, justifyContent: "center", alignItems: "center" }}>
              <ActivityIndicator color="#fff" />
            </View>
          ) : (
            <View style={styles.grid}>
              {/* Left Column */}
              <View style={[styles.column, { marginRight: GAP / 2 }]}>
                {gridItems.filter((_, i) => i % 2 === 0).map((item) => (
                  <GridCard
                    key={item.id}
                    item={item}
                    liked={likedItems[item.id] ?? false}
                    saved={savedItems[item.id] ?? false}
                    likesCount={likeCounts[item.id] ?? 0}
                    onLike={() => toggleLike(item.id)}
                    onSave={() => toggleSave(item.id)}
                    onCommentPress={() => handleCommentPress(item.id)}
                    openProfile={() => openProfile(item.owner_clerk_id)}
                  />
                ))}
              </View>
              {/* Right Column */}
              <View style={[styles.column, { marginLeft: GAP / 2 }]}>
                {gridItems.filter((_, i) => i % 2 !== 0).map((item) => (
                  <GridCard
                    key={item.id}
                    item={item}
                    liked={likedItems[item.id] ?? false}
                    saved={savedItems[item.id] ?? false}
                    likesCount={likeCounts[item.id] ?? 0}
                    onLike={() => toggleLike(item.id)}
                    onSave={() => toggleSave(item.id)}
                    onCommentPress={() => handleCommentPress(item.id)}
                    openProfile={() => openProfile(item.owner_clerk_id)}
                  />
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}
      {commentModalVisible && selectedPostId && user && (
        <CommentModal
          postId={selectedPostId}
          visible={commentModalVisible}
          onClose={() => setCommentModalVisible(false)}
          user={user}
        />
      )}
    </View>
  );
}

function GridCard({
  item,
  liked,
  saved,
  likesCount,
  onLike,
  onSave,
  onCommentPress,
  openProfile,
}: {
  item: GridItem;
  liked: boolean;
  saved: boolean;
  likesCount: number;
  onLike: () => void;
  onSave: () => void;
  onCommentPress: () => void;
  openProfile: () => void;
}) {
  const height = item.tall ? COL_WIDTH * 1.5 : COL_WIDTH * 0.85;
  return (
    <View style={[styles.gridCard, { height, marginBottom: GAP }]}>
      <Image source={{ uri: item.image }} style={styles.gridImage} />
      <View style={styles.gridOverlay} />

      {/* Username at bottom left - clickable */}
      <TouchableOpacity style={styles.gridUserInfo} onPress={openProfile}>
        <Image source={{ uri: item.avatar }} style={styles.gridAvatar} />
        <Text style={styles.gridUsername} numberOfLines={1}>{item.username}</Text>
      </TouchableOpacity>

      {/* Actions at bottom right */}
      <View style={styles.gridActions}>
        <TouchableOpacity onPress={onLike} style={styles.gridActionBtn} activeOpacity={0.7}>
          <Text style={{ fontSize: 14 }}>{liked ? "❤️" : "🤍"}</Text>
          {likesCount > 0 && <Text style={{ fontSize: 9, color: "#fff" }}>{likesCount}</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={onCommentPress} style={styles.gridActionBtn} activeOpacity={0.7}>
          <Text style={{ fontSize: 14 }}>💬</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onSave} style={styles.gridActionBtn}>
          <Text style={{ fontSize: 14, color: saved ? PRIMARY : "#ccc" }}>🔖</Text>
        </TouchableOpacity>
      </View>
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
  
  // Grid
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
  
  // Grid Card
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
  gridUserInfo: {
    position: "absolute",
    bottom: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: COL_WIDTH - 60,
  },
  gridAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  gridUsername: { color: "#fff", fontSize: 11, fontWeight: "600", maxWidth: COL_WIDTH - 90 },
  gridActions: {
    position: "absolute",
    bottom: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  gridActionBtn: {
    width: 32,
    minHeight: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    paddingVertical: 2,
  },
  
  // People Search
  peopleContainer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120 },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: CARD_DARK,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  personAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  personTextBlock: { flex: 1, gap: 3 },
  personName: { color: "#fff", fontSize: 14, fontWeight: "800" },
  personHandle: { color: "rgba(255,255,255,0.45)", fontSize: 12, fontWeight: "700" },
  personChevron: { color: "rgba(255,255,255,0.35)", fontSize: 18, fontWeight: "800" },
});
