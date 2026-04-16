import { useUser } from "@clerk/clerk-expo";
import React, { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "expo-router";
import {
  Animated,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  FlatList,
  StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../lib/supabase";
import { SERVER_BASE } from "../utils/config";
import CommentModal from "../../components/CommentModal";

// ─── Design Tokens ──────────────────────────────────────────────────────────
const PRIMARY = "#FF4D00";
const PRIMARY_SOFT = "#FF6B2B";
const ACCENT = "#F5C842";
const BG = "#080707";
const SURFACE = "#111010";
const SURFACE_2 = "#1C1A19";
const BORDER = "rgba(255,255,255,0.06)";
const TEXT_PRIMARY = "#F0ECE8";
const TEXT_MUTED = "rgba(240,236,232,0.4)";
const TEXT_FAINT = "rgba(240,236,232,0.2)";

const { width: WIDTH } = Dimensions.get("window");
const GAP = 8;
const COL_WIDTH = (WIDTH - 32 - GAP) / 2;

const DEFAULT_AVATAR =
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&q=80";

const CATEGORIES = [
  { label: "For You", icon: "✦" },
  { label: "Streetwear", icon: "🧥" },
  { label: "Minimal", icon: "◻" },
  { label: "Vintage", icon: "📻" },
  { label: "Y2K", icon: "⚡" },
  { label: "Formal", icon: "🎩" },
  { label: "Grunge", icon: "🔗" },
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

// ─── Animated Chip ──────────────────────────────────────────────────────────
function CategoryChip({
  cat,
  active,
  onPress,
}: {
  cat: { label: string; icon: string };
  active: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.93, duration: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[styles.chip, active && styles.chipActive]}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        {active && (
          <LinearGradient
            colors={[PRIMARY, PRIMARY_SOFT]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
            // eslint-disable-next-line react-native/no-inline-styles
            borderRadius={999}
          />
        )}
        <Text style={styles.chipIcon}>{cat.icon}</Text>
        <Text style={[styles.chipText, active && styles.chipTextActive]}>
          {cat.label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Grid Card ───────────────────────────────────────────────────────────────
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
  const height = item.tall ? COL_WIDTH * 1.55 : COL_WIDTH * 0.9;
  const likeScale = useRef(new Animated.Value(1)).current;

  const handleLike = () => {
    Animated.sequence([
      Animated.spring(likeScale, { toValue: 1.5, useNativeDriver: true, speed: 40 }),
      Animated.spring(likeScale, { toValue: 1, useNativeDriver: true }),
    ]).start();
    onLike();
  };

  return (
    <TouchableOpacity
      style={[styles.gridCard, { height, marginBottom: GAP }]}
      activeOpacity={0.96}
    >
      <Image source={{ uri: item.image }} style={styles.gridImage} />

      {/* Bottom gradient */}
      <LinearGradient
        colors={["transparent", "rgba(4,3,3,0.85)"]}
        style={styles.gridGradient}
      />

      {/* Trending badge — random on tall items */}
      {item.tall && (
        <View style={styles.trendingBadge}>
          <Text style={styles.trendingText}>TRENDING</Text>
        </View>
      )}

      {/* User pill */}
      <TouchableOpacity style={styles.gridUserInfo} onPress={openProfile} activeOpacity={0.8}>
        <Image source={{ uri: item.avatar }} style={styles.gridAvatar} />
        <Text style={styles.gridUsername} numberOfLines={1}>
          {item.username}
        </Text>
      </TouchableOpacity>

      {/* Actions */}
      <View style={styles.gridActions}>
        <TouchableOpacity onPress={handleLike} activeOpacity={0.8}>
          <Animated.View style={[styles.actionBtn, { transform: [{ scale: likeScale }] }]}>
            <Text style={{ fontSize: 13 }}>{liked ? "❤️" : "🤍"}</Text>
            {likesCount > 0 && (
              <Text style={styles.actionCount}>{likesCount}</Text>
            )}
          </Animated.View>
        </TouchableOpacity>

        <TouchableOpacity onPress={onCommentPress} activeOpacity={0.8}>
          <View style={styles.actionBtn}>
            <Text style={{ fontSize: 13 }}>💬</Text>
            {item.commentsCount > 0 && (
              <Text style={styles.actionCount}>{item.commentsCount}</Text>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={onSave} activeOpacity={0.8}>
          <View style={[styles.actionBtn, saved && styles.actionBtnSaved]}>
            <Text style={{ fontSize: 13 }}>{saved ? "🔖" : "🔖"}</Text>
          </View>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ─── Person Row ──────────────────────────────────────────────────────────────
function PersonRow({
  person,
  index,
  onPress,
}: {
  person: ProfileLite;
  index: number;
  onPress: () => void;
}) {
  const slideAnim = useRef(new Animated.Value(30)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 280,
        delay: index * 50,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 280,
        delay: index * 50,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handle = person.username
    ? person.username.startsWith("@")
      ? person.username
      : `@${person.username}`
    : null;
  const title =
    person.full_name || handle || person.clerk_id || `User #${index + 1}`;
  const avatarUri = person.profile_image_url || DEFAULT_AVATAR;

  return (
    <Animated.View
      style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
    >
      <TouchableOpacity
        style={styles.personRow}
        activeOpacity={0.85}
        onPress={onPress}
      >
        <View style={styles.personAvatarWrap}>
          <Image source={{ uri: avatarUri }} style={styles.personAvatar} />
          <View style={styles.onlineDot} />
        </View>

        <View style={styles.personTextBlock}>
          <Text style={styles.personName} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.personHandle} numberOfLines={1}>
            {handle || String(person.clerk_id || "")}
          </Text>
        </View>

        <View style={styles.followBtn}>
          <Text style={styles.followBtnText}>Follow</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const router = useRouter();

  const [activeCategory, setActiveCategory] = useState(0);
  const [gridItems, setGridItems] = useState<GridItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [peopleResults, setPeopleResults] = useState<ProfileLite[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [likedItems, setLikedItems] = useState<Record<string, boolean>>({});
  const [savedItems, setSavedItems] = useState<Record<string, boolean>>({});
  const [persistedDataLoaded, setPersistedDataLoaded] = useState(false);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  const scrollY = useRef(new Animated.Value(0)).current;
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [1, 0.97],
    extrapolate: "clamp",
  });

  const userAvatar =
    (user?.unsafeMetadata as { profileImageUrl?: string })?.profileImageUrl ||
    user?.imageUrl ||
    DEFAULT_AVATAR;
  const username =
    (user as any)?.username ||
    user?.fullName ||
    (user?.unsafeMetadata as { name?: string } | undefined)?.name ||
    "@you";

  // ── Persist helpers ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const lk = await AsyncStorage.getItem(`fitsense_liked_${user.id}`);
        const sv = await AsyncStorage.getItem(`fitsense_saved_${user.id}`);
        if (lk) setLikedItems(JSON.parse(lk));
        if (sv) setSavedItems(JSON.parse(sv));
      } catch {}
      setPersistedDataLoaded(true);
    })();
  }, [user?.id]);

  useEffect(() => {
    if (!persistedDataLoaded || !user?.id) return;
    AsyncStorage.setItem(`fitsense_liked_${user.id}`, JSON.stringify(likedItems)).catch(() => {});
  }, [likedItems, user?.id, persistedDataLoaded]);

  useEffect(() => {
    if (!persistedDataLoaded || !user?.id) return;
    AsyncStorage.setItem(`fitsense_saved_${user.id}`, JSON.stringify(savedItems)).catch(() => {});
  }, [savedItems, user?.id, persistedDataLoaded]);

  // ── Fetch grid ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        if (!user?.id) { setGridItems([]); return; }
        const resp = await fetch(`${SERVER_BASE}/api/for-you`, {
          headers: { Authorization: `Bearer dev:${user.id}` },
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error((json as any)?.error || "Failed");
        const data = (json as any)?.posts ?? [];
        const mapped: GridItem[] = data.map((p: any, i: number) => ({
          id: String(p.id),
          image: String(p.image_url),
          username: p.owner_profile?.full_name || p.owner_profile?.username || "Unknown",
          avatar: p.owner_profile?.profile_image_url || DEFAULT_AVATAR,
          tall: i % 3 !== 1,
          commentsCount: p.comments_count ?? 0,
          owner_clerk_id: p.owner_clerk_id,
        }));
        if (!cancelled) setGridItems(mapped);
      } catch { if (!cancelled) setGridItems([]); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  // ── Search people ─────────────────────────────────────────────────────────
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) { setPeopleResults([]); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        setPeopleLoading(true);
        const resp = await fetch(
          `${SERVER_BASE}/api/profile/search?query=${encodeURIComponent(q)}&limit=20`
        );
        if (!resp.ok) throw new Error("search failed");
        const json = await resp.json();
        if (!cancelled) setPeopleResults(Array.isArray(json.users) ? json.users : []);
      } catch { if (!cancelled) setPeopleResults([]); }
      finally { if (!cancelled) setPeopleLoading(false); }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [searchQuery]);

  const openProfile = (clerkId: string) =>
    router.push({ pathname: "/(tabs)/profile", params: { user_id: clerkId } });

  const toggleLike = (id: string) => {
    setLikedItems((prev) => ({ ...prev, [id]: !prev[id] }));
    setLikeCounts((prev) => ({
      ...prev,
      [id]: (prev[id] ?? 0) + (likedItems[id] ? -1 : 1),
    }));
  };

  const toggleSave = (id: string) =>
    setSavedItems((prev) => ({ ...prev, [id]: !prev[id] }));

  const isSearching = searchQuery.trim().length > 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      {/* Decorative background orbs */}
      <View style={styles.orbTopRight} />
      <View style={styles.orbBottomLeft} />

      {/* ── Header ── */}
      <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
        {/* Top row */}
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.brandLabel}>FITSENSE</Text>
            <Text style={styles.title}>Explore</Text>
          </View>
          <View style={styles.headerRight}>
           
            <TouchableOpacity style={styles.avatarBtn} onPress={() => openProfile(user?.id ?? "")}>
              <Image source={{ uri: userAvatar }} style={styles.avatar} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search bar */}
        <View style={[styles.searchBar, searchFocused && styles.searchBarFocused]}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search creators, styles…"
            placeholderTextColor={TEXT_FAINT}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearBtn}>
              <Text style={{ color: TEXT_MUTED, fontSize: 14 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Category chips */}
        {!isSearching && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {CATEGORIES.map((cat, i) => (
              <CategoryChip
                key={cat.label}
                cat={cat}
                active={activeCategory === i}
                onPress={() => setActiveCategory(i)}
              />
            ))}
          </ScrollView>
        )}
      </Animated.View>

      {/* ── Content ── */}
      {isSearching ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.peopleContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionAccentBar} />
              <Text style={styles.sectionTitle}>People</Text>
            </View>
            <Text style={styles.resultCount}>
              {peopleLoading ? "…" : `${peopleResults.length} found`}
            </Text>
          </View>

          {peopleLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={PRIMARY} />
              <Text style={styles.loadingText}>Searching creators…</Text>
            </View>
          ) : peopleResults.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🔎</Text>
              <Text style={styles.emptyTitle}>No results found</Text>
              <Text style={styles.emptySubtitle}>
                Try a different name or username
              </Text>
            </View>
          ) : (
            peopleResults.map((p, idx) => (
              <PersonRow
                key={String(p.clerk_id || idx)}
                person={p}
                index={idx}
                onPress={() => p.clerk_id && openProfile(String(p.clerk_id))}
              />
            ))
          )}
        </ScrollView>
      ) : (
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.gridContainer}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
        >
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionAccentBar} />
              <Text style={styles.sectionTitle}>
                {CATEGORIES[activeCategory].label}
              </Text>
            </View>
            <Text style={styles.postCount}>
              {loading ? "…" : `${gridItems.length} posts`}
            </Text>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={PRIMARY} size="large" />
              <Text style={styles.loadingText}>Loading fits…</Text>
            </View>
          ) : gridItems.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>👗</Text>
              <Text style={styles.emptyTitle}>Nothing here yet</Text>
              <Text style={styles.emptySubtitle}>Be the first to post a fit</Text>
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
                    onCommentPress={() => {
                      setSelectedPostId(item.id);
                      setCommentModalVisible(true);
                    }}
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
                    onCommentPress={() => {
                      setSelectedPostId(item.id);
                      setCommentModalVisible(true);
                    }}
                    openProfile={() => openProfile(item.owner_clerk_id)}
                  />
                ))}
              </View>
            </View>
          )}
        </Animated.ScrollView>
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

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },

  // Background orbs
  orbTopRight: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(255,77,0,0.06)",
    top: -60,
    right: -80,
  },
  orbBottomLeft: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(245,200,66,0.04)",
    bottom: 160,
    left: -80,
  },

  // ── Header
  header: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: "rgba(8,7,7,0.95)",
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 14,
  },
  brandLabel: {
    color: PRIMARY,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 3,
    marginBottom: 1,
  },
  title: {
    color: TEXT_PRIMARY,
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: -1,
    lineHeight: 34,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingBottom: 2,
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: SURFACE_2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: BORDER,
  },
  notifDot: {
    position: "absolute",
    top: 9,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: PRIMARY,
    borderWidth: 1.5,
    borderColor: BG,
  },
  avatarBtn: {
    borderRadius: 14,
    borderWidth: 2,
    borderColor: PRIMARY,
    overflow: "hidden",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
  },

  // ── Search
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: SURFACE,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  searchBarFocused: {
    borderColor: "rgba(255,77,0,0.4)",
    backgroundColor: SURFACE_2,
  },
  searchIcon: {
    color: TEXT_MUTED,
    fontSize: 20,
    marginRight: 10,
    lineHeight: 22,
  },
  searchInput: {
    flex: 1,
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: "500",
    padding: 0,
  },
  clearBtn: {
    padding: 4,
  },

  // ── Chips
  chipsRow: {
    paddingBottom: 12,
    paddingTop: 2,
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
  },
  chipActive: {
    borderColor: "transparent",
  },
  chipIcon: {
    fontSize: 11,
    color: TEXT_MUTED,
  },
  chipText: {
    color: TEXT_MUTED,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  chipTextActive: {
    color: "#fff",
  },

  // ── Section header
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionAccentBar: {
    width: 3,
    height: 18,
    borderRadius: 2,
    backgroundColor: PRIMARY,
  },
  sectionTitle: {
    color: TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  postCount: {
    color: TEXT_MUTED,
    fontSize: 12,
    fontWeight: "600",
  },
  resultCount: {
    color: TEXT_MUTED,
    fontSize: 12,
    fontWeight: "600",
  },

  // ── Grid
  gridContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 120,
  },
  grid: {
    flexDirection: "row",
  },
  column: {
    flex: 1,
  },

  // ── Grid Card
  gridCard: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: SURFACE,
    position: "relative",
  },
  gridImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  gridGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "55%",
  },
  trendingBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: ACCENT,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  trendingText: {
    color: "#000",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1,
  },
  gridUserInfo: {
    position: "absolute",
    bottom: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    maxWidth: COL_WIDTH - 72,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 20,
    paddingRight: 8,
    paddingLeft: 3,
    paddingVertical: 3,
  },
  gridAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  gridUsername: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    maxWidth: COL_WIDTH - 100,
  },
  gridActions: {
    position: "absolute",
    bottom: 8,
    right: 8,
    gap: 5,
    alignItems: "center",
  },
  actionBtn: {
    width: 32,
    minHeight: 32,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingVertical: 2,
  },
  actionBtnSaved: {
    borderColor: PRIMARY,
    backgroundColor: "rgba(255,77,0,0.2)",
  },
  actionCount: {
    fontSize: 8,
    color: "rgba(255,255,255,0.85)",
    fontWeight: "700",
    lineHeight: 10,
  },

  // ── People search
  peopleContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 120,
  },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: SURFACE,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  personAvatarWrap: {
    position: "relative",
  },
  personAvatar: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: SURFACE_2,
  },
  onlineDot: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#2ECC71",
    borderWidth: 2,
    borderColor: SURFACE,
  },
  personTextBlock: {
    flex: 1,
    gap: 3,
  },
  personName: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  personHandle: {
    color: TEXT_MUTED,
    fontSize: 12,
    fontWeight: "600",
  },
  followBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: PRIMARY,
  },
  followBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
  },

  // ── States
  loadingContainer: {
    paddingVertical: 60,
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    color: TEXT_MUTED,
    fontSize: 13,
    fontWeight: "600",
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: "center",
    gap: 8,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 4,
  },
  emptyTitle: {
    color: TEXT_PRIMARY,
    fontSize: 17,
    fontWeight: "800",
  },
  emptySubtitle: {
    color: TEXT_MUTED,
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 32,
    lineHeight: 18,
  },
});