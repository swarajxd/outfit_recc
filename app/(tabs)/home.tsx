import { useUser } from "@clerk/clerk-expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CommentModal from "../../components/CommentModal";
import { SERVER_BASE } from "../utils/config";
import {
  GeneratedOutfit
} from "../utils/outfitEngine";

const PRIMARY = "#FF6B00";
const BG = "#0A0A0A";
const WIDTH = Dimensions.get("window").width;
const HALF = (WIDTH - 48) / 2;

const DEFAULT_AVATAR =
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&q=80";

type Post = {
  id: string;
  image_url: string;
  caption: string | null;
  owner_clerk_id: string;
  owner_profile?: {
    clerk_id?: string | null;
    username?: string | null;
    full_name?: string | null;
    profile_image_url?: string | null;
  } | null;
  tags: string[] | null;
  created_at: string;
  score?: number;
  isLiked?: boolean;
  likes_count?: number;
  comments_count?: number;
};

// ─── AI Tool Pill (Stories-row style) ────────────────────────────────────────
function AIToolBubble({
  icon,
  label,
  accent,
  onPress,
}: {
  icon: string;
  label: string;
  accent: string;
  onPress?: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={() =>
        Animated.spring(scale, { toValue: 0.93, useNativeDriver: true, speed: 40 }).start()
      }
      onPressOut={() =>
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()
      }
      activeOpacity={1}
      style={{ alignItems: "center", gap: 6 }}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        {/* Gradient ring like IG story ring */}
        <LinearGradient
          colors={[accent, PRIMARY, "#FF3CAC"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.aiBubbleRing}
        >
          <View style={styles.aiBubbleInner}>
            <Text style={styles.aiBubbleIcon}>{icon}</Text>
          </View>
        </LinearGradient>
      </Animated.View>
      <Text style={styles.aiBubbleLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Masonry Pin Card (Pinterest style) ──────────────────────────────────────
function PinCard({
  item,
  height,
  liked,
  onLike,
  likesCount,
  onCommentPress,
  saved,
  onSave,
  onUserPress,
}: {
  item: any;
  height: number;
  liked: boolean;
  onLike: () => void;
  likesCount: number;
  onCommentPress: () => void;
  saved: boolean;
  onSave: () => void;
  onUserPress: () => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const toggleActions = () => {
    const toValue = showActions ? 0 : 1;
    setShowActions(!showActions);
    Animated.timing(fadeAnim, {
      toValue,
      duration: 160,
      useNativeDriver: true,
    }).start();
  };

  return (
    <TouchableOpacity
      onPress={toggleActions}
      activeOpacity={0.97}
      style={[styles.pinCard, { height }]}
    >
      <Image
        source={{ uri: item.image }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />

      {/* Bottom gradient always visible for username */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.72)"]}
        style={styles.pinGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      {/* Score badge top-left */}
      {item.matchPercent > 0 && (
        <View style={styles.pinScore}>
          <Text style={styles.pinScoreText}>{item.matchPercent}%</Text>
        </View>
      )}

      {/* Save button top-right always */}
      <TouchableOpacity onPress={onSave} style={styles.pinSaveBtn}>
        <View style={[styles.pinSavePill, saved && { backgroundColor: PRIMARY }]}>
          <Text style={styles.pinSaveTxt}>{saved ? "Saved" : "Save"}</Text>
        </View>
      </TouchableOpacity>

      {/* Bottom row: avatar + username */}
      <View style={styles.pinBottom}>
        <TouchableOpacity onPress={onUserPress} style={styles.pinUser}>
          <Image source={{ uri: item.avatar }} style={styles.pinAvatar} />
          <Text style={styles.pinUsername} numberOfLines={1}>
            {item.username}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Overlay actions on tap */}
      <Animated.View
        pointerEvents={showActions ? "auto" : "none"}
        style={[styles.pinOverlay, { opacity: fadeAnim }]}
      >
        <View style={styles.pinOverlayActions}>
          <TouchableOpacity onPress={onLike} style={styles.pinActionBtn}>
            <Text style={[styles.pinActionIcon, liked && { color: "#FF3B30" }]}>
              {liked ? "♥" : "♡"}
            </Text>
            <Text style={styles.pinActionCount}>{likesCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onCommentPress} style={styles.pinActionBtn}>
            <Text style={styles.pinActionIcon}>💬</Text>
          </TouchableOpacity>
        </View>
        {item.caption ? (
          <Text style={styles.pinCaption} numberOfLines={2}>
            {item.caption}
          </Text>
        ) : null}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isLoaded } = useUser();

  const [activeTab, setActiveTab] = useState<"foryou" | "following">("foryou");
  const isFollowingTab = activeTab === "following";

  const [likedItems, setLikedItems] = useState<Record<string, boolean>>({});
  const [savedItems, setSavedItems] = useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [persistedDataLoaded, setPersistedDataLoaded] = useState(false);

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [postsError, setPostsError] = useState<string | null>(null);
  const postsFetchInFlight = useRef(false);

  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  const [items, setItems] = useState<any[]>([]);
  const [outfit, setOutfit] = useState<GeneratedOutfit | null>(null);

  const scrollY = useRef(new Animated.Value(0)).current;
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [1, 0.96],
    extrapolate: "clamp",
  });

  if (!isLoaded) return null;

  const currentUserAvatar =
    (user?.unsafeMetadata as any)?.profileImageUrl ||
    user?.imageUrl ||
    DEFAULT_AVATAR;
  const currentUserName =
    user?.fullName ||
    (user?.unsafeMetadata as any)?.name ||
    (user as any)?.primaryEmailAddress?.emailAddress ||
    "Unknown";

  // ── Persisted state ──
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const l = await AsyncStorage.getItem(`fitsense_liked_${user.id}`);
        const s = await AsyncStorage.getItem(`fitsense_saved_${user.id}`);
        if (l) setLikedItems(JSON.parse(l));
        if (s) setSavedItems(JSON.parse(s));
        setPersistedDataLoaded(true);
      } catch {
        setPersistedDataLoaded(true);
      }
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

  // ── Auth header ──
  async function getAuthHeader(): Promise<string | null> {
    if (!user?.id) return null;
    return `Bearer dev:${user.id}`;
  }

  // ── Fetch posts ──
  async function fetchPosts() {
    if (postsFetchInFlight.current) return;
    postsFetchInFlight.current = true;
    try {
      setPostsError(null);
      setLoading(true);
      setPosts([]);
      if (!user?.id) return;
      const authHeader = await getAuthHeader();
      if (!authHeader) return;
      const endpoint = isFollowingTab ? "/api/following" : "/api/for-you";
      const resp = await fetch(`${SERVER_BASE}${endpoint}`, {
        headers: { Authorization: authHeader },
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error((json as any)?.error || "Failed to load feed");
      const data = (json as any)?.posts ?? [];
      const normalized: Post[] = data.map((p: any) => ({
        id: String(p.id),
        image_url: String(p.image_url),
        caption: p.caption ?? null,
        owner_clerk_id: String(p.owner_clerk_id ?? ""),
        owner_profile: p.owner_profile,
        tags: Array.isArray(p.tags) ? p.tags.map((t: any) => String(t)) : null,
        created_at: String(p.created_at ?? ""),
        score: typeof p.score === "number" ? Math.round(p.score * 100) : undefined,
        liked: p.liked === true,
        comments_count: p.comments_count || 0,
      }));
      setPosts(normalized);
      const postIds = normalized.map((p) => p.id);
      if (postIds.length > 0) {
        const lr = await fetch(
          `${SERVER_BASE}/api/posts/likes-count?${postIds.map((id) => `post_ids=${id}`).join("&")}`,
          { headers: { Authorization: authHeader } }
        );
        const lj = await lr.json().catch(() => ({}));
        if (lr.ok && lj.likeCounts) setLikeCounts(lj.likeCounts);
      }
    } catch (e) {
      setPostsError((e as any)?.message || String(e));
      setPosts([]);
    } finally {
      postsFetchInFlight.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { fetchPosts(); }, [activeTab, user?.id]);

  // ── Like handler ──
  async function handleLike(post_id: string) {
    const authHeader = await getAuthHeader();
    if (!authHeader || !user?.id) return;
    const wasLiked = !!likedItems[post_id];
    setLikedItems((p) => ({ ...p, [post_id]: !p[post_id] }));
    setLikeCounts((p) => ({ ...p, [post_id]: Math.max(0, (p[post_id] || 0) + (wasLiked ? -1 : 1)) }));
    try {
      const resp = await fetch(`${SERVER_BASE}/api/like-toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({ post_id }),
      });
      if (!resp.ok) throw new Error();
    } catch {
      setLikedItems((p) => ({ ...p, [post_id]: !p[post_id] }));
      setLikeCounts((p) => ({ ...p, [post_id]: Math.max(0, (p[post_id] || 0) + (wasLiked ? 1 : -1)) }));
    }
  }

  // ── Save handler ──
  async function handleSave(post_id: string) {
    if (!user?.id) return;
    try {
      const resp = await fetch(`${SERVER_BASE}/api/save-post`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": user.id },
        body: JSON.stringify({ post_id }),
      });
      const json = JSON.parse(await resp.text());
      setSavedItems((p) => ({ ...p, [post_id]: json.saved }));
    } catch (err) {
      console.error("SAVE ERROR:", err);
    }
  }

  // ── Wardrobe ──
  useEffect(() => {
    if (!user?.id) return;
    fetch(`${SERVER_BASE}/api/profile/wardrobe/${user.id}`)
      .then((r) => r.json())
      .then((data) => {
        const w = data?.wardrobe || {};
        const fetched: any[] = [];
        for (const key of Object.keys(w)) {
          const arr = Array.isArray(w[key]) ? w[key] : [];
          for (const item of arr) fetched.push({ id: item.id, image: item.image, category: item.category });
        }
        setItems(fetched);
      })
      .catch(() => {});
  }, [user]);

  // ── Build masonry columns ──
  // Heights alternate tall/short for Pinterest rhythm
  const masonryLeft: { post: Post; height: number }[] = [];
  const masonryRight: { post: Post; height: number }[] = [];
  posts.forEach((post, i) => {
    // Vary heights: tall ~260, short ~190, medium ~220
    const heights = [260, 190, 220, 280, 195];
    const h = heights[i % heights.length];
    if (i % 2 === 0) masonryLeft.push({ post, height: h });
    else masonryRight.push({ post, height: h });
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />

      {/* ── Sticky Header (Instagram style) ── */}
      <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
        <View style={styles.headerInner}>
          {/* Logo */}
          <Text style={styles.logo}>
            fit<Text style={{ color: PRIMARY }}>sense</Text>
          </Text>

          {/* Tab toggle — minimal underline style */}
          <View style={styles.tabRow}>
            <TouchableOpacity onPress={() => setActiveTab("foryou")} style={styles.tabBtn}>
              <Text style={[styles.tabTxt, activeTab === "foryou" && styles.tabTxtActive]}>
                For You
              </Text>
              {activeTab === "foryou" && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setActiveTab("following")} style={styles.tabBtn}>
              <Text style={[styles.tabTxt, activeTab === "following" && styles.tabTxtActive]}>
                Following
              </Text>
              {activeTab === "following" && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
          </View>

          {/* Avatar */}
          <TouchableOpacity onPress={() => router.push("/profile")}>
            <Image source={{ uri: currentUserAvatar }} style={styles.headerAvatar} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ── Scrollable content ── */}
      <Animated.ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 80 }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchPosts(); }}
            tintColor={PRIMARY}
          />
        }
      >
        {/* ── AI Tools — Stories row ── */}
        <View style={styles.storiesSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.storiesRow}
          >
            {/* Create post "new story" button */}
            <TouchableOpacity
              onPress={() => router.push("/create-post")}
              style={{ alignItems: "center", gap: 6 }}
            >
              <View style={styles.newStoryRing}>
                <View style={styles.newStoryInner}>
                  <Text style={styles.newStoryPlus}>+</Text>
                </View>
              </View>
              <Text style={styles.aiBubbleLabel}>Post</Text>
            </TouchableOpacity>

            <AIToolBubble
              icon="✦"
              label="Outfit AI"
              accent="#FF6B00"
              onPress={() =>
                router.push({
                  pathname: "../outfitMaker",
                  params: { wardrobe: JSON.stringify(items) },
                })
              }
            />
            <AIToolBubble
              icon="◈"
              label="Style Chat"
              accent="#A78BFA"
            />
          </ScrollView>
        </View>

        {/* Thin divider */}
        <View style={styles.divider} />

        {/* ── Pinterest masonry grid ── */}
        <View style={styles.masonrySection}>
          {loading ? (
            <View style={{ paddingVertical: 60, alignItems: "center" }}>
              <ActivityIndicator color={PRIMARY} size="large" />
              <Text style={styles.loadingTxt}>Loading fits…</Text>
            </View>
          ) : postsError ? (
            <Text style={styles.emptyTxt}>Couldn't load posts. Pull to refresh.</Text>
          ) : posts.length === 0 ? (
            <Text style={styles.emptyTxt}>
              {isFollowingTab ? "No posts yet from people you follow." : "No posts yet."}
            </Text>
          ) : (
            <View style={styles.masonryRow}>
              {/* Left column */}
              <View style={styles.masonryCol}>
                {masonryLeft.map(({ post, height }) => {
                  const owner = post.owner_profile || {};
                  const isLiked = !!likedItems[post.id];
                  const item = {
                    id: post.owner_clerk_id,
                    image: post.image_url,
                    matchPercent: post.score ?? 0,
                    username:
                      owner.username ||
                      (post.owner_clerk_id === user?.id ? currentUserName : "Unknown"),
                    avatar:
                      owner.profile_image_url ||
                      (post.owner_clerk_id === user?.id ? currentUserAvatar : DEFAULT_AVATAR),
                    caption: post.caption ?? "",
                    tag: post.tags?.[0] ? `#${post.tags[0]}` : "",
                  };
                  return (
                    <PinCard
                      key={post.id}
                      item={item}
                      height={height}
                      liked={isLiked}
                      onLike={() => handleLike(post.id)}
                      likesCount={likeCounts[post.id] || 0}
                      onCommentPress={() => {
                        setSelectedPostId(post.id);
                        setCommentModalVisible(true);
                      }}
                      saved={!!savedItems[post.id]}
                      onSave={() => handleSave(post.id)}
                      onUserPress={() =>
                        router.push({ pathname: "/profile", params: { userId: post.owner_clerk_id } })
                      }
                    />
                  );
                })}
              </View>

              {/* Right column — offset top for Pinterest stagger */}
              <View style={[styles.masonryCol, { marginTop: 28 }]}>
                {masonryRight.map(({ post, height }) => {
                  const owner = post.owner_profile || {};
                  const isLiked = !!likedItems[post.id];
                  const item = {
                    id: post.owner_clerk_id,
                    image: post.image_url,
                    matchPercent: post.score ?? 0,
                    username:
                      owner.username ||
                      (post.owner_clerk_id === user?.id ? currentUserName : "Unknown"),
                    avatar:
                      owner.profile_image_url ||
                      (post.owner_clerk_id === user?.id ? currentUserAvatar : DEFAULT_AVATAR),
                    caption: post.caption ?? "",
                    tag: post.tags?.[0] ? `#${post.tags[0]}` : "",
                  };
                  return (
                    <PinCard
                      key={post.id}
                      item={item}
                      height={height}
                      liked={isLiked}
                      onLike={() => handleLike(post.id)}
                      likesCount={likeCounts[post.id] || 0}
                      onCommentPress={() => {
                        setSelectedPostId(post.id);
                        setCommentModalVisible(true);
                      }}
                      saved={!!savedItems[post.id]}
                      onSave={() => handleSave(post.id)}
                      onUserPress={() =>
                        router.push({ pathname: "/profile", params: { userId: post.owner_clerk_id } })
                      }
                    />
                  );
                })}
              </View>
            </View>
          )}
        </View>
      </Animated.ScrollView>

      {/* Comment Modal */}
      {selectedPostId && (
        <CommentModal
          visible={commentModalVisible}
          postId={selectedPostId}
          onClose={() => setCommentModalVisible(false)}
          serverBase={SERVER_BASE}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },

  // ── Header ──
  header: {
    backgroundColor: BG,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
    zIndex: 10,
  },
  headerInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  logo: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.5,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    fontStyle: "italic",
  },
  tabRow: {
    flexDirection: "row",
    gap: 24,
    alignItems: "center",
  },
  tabBtn: {
    alignItems: "center",
    paddingBottom: 2,
    position: "relative",
  },
  tabTxt: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.35)",
    letterSpacing: 0.1,
  },
  tabTxtActive: {
    color: "#fff",
    fontWeight: "700",
  },
  tabUnderline: {
    position: "absolute",
    bottom: -2,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: PRIMARY,
    borderRadius: 1,
  },
  headerAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: PRIMARY,
  },

  scroll: { flex: 1 },

  // ── Stories / AI row ──
  storiesSection: {
    paddingVertical: 14,
  },
  storiesRow: {
    paddingHorizontal: 16,
    gap: 20,
    flexDirection: "row",
    alignItems: "flex-start",
  },

  // New post "story" circle
  newStoryRing: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: "#1A1A1A",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.12)",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  newStoryInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#1E1E1E",
    alignItems: "center",
    justifyContent: "center",
  },
  newStoryPlus: {
    color: PRIMARY,
    fontSize: 28,
    fontWeight: "300",
    lineHeight: 32,
  },

  // AI bubble with gradient ring
  aiBubbleRing: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: "center",
    justifyContent: "center",
    padding: 2.5,
  },
  aiBubbleInner: {
    width: "100%",
    height: "100%",
    borderRadius: 30,
    backgroundColor: "#141414",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: BG,
  },
  aiBubbleIcon: {
    fontSize: 24,
    color: "#fff",
  },
  aiBubbleLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.55)",
    fontWeight: "500",
    letterSpacing: 0.1,
    textAlign: "center",
    maxWidth: 66,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.07)",
    marginHorizontal: 0,
  },

  // ── Masonry ──
  masonrySection: {
    paddingTop: 12,
    paddingHorizontal: 12,
  },
  masonryRow: {
    flexDirection: "row",
    gap: 8,
  },
  masonryCol: {
    flex: 1,
    gap: 8,
  },

  // ── Pin card ──
  pinCard: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#1A1A1A",
    position: "relative",
  },
  pinGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "55%",
    zIndex: 1,
  },
  pinScore: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    zIndex: 2,
    backdropFilter: "blur(4px)",
  },
  pinScoreText: {
    fontSize: 10,
    fontWeight: "800",
    color: PRIMARY,
    letterSpacing: 0.3,
  },
  pinSaveBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 2,
  },
  pinSavePill: {
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  pinSaveTxt: {
    fontSize: 11,
    fontWeight: "800",
    color: "#000",
    letterSpacing: 0.1,
  },
  pinBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    zIndex: 2,
  },
  pinUser: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pinAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  pinUsername: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    flex: 1,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // Tap overlay
  pinOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.52)",
    zIndex: 5,
    padding: 14,
    justifyContent: "flex-end",
    gap: 8,
  },
  pinOverlayActions: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
  },
  pinActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  pinActionIcon: {
    fontSize: 20,
    color: "#fff",
  },
  pinActionCount: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  pinCaption: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "400",
  },

  loadingTxt: {
    color: "rgba(255,255,255,0.35)",
    marginTop: 12,
    fontSize: 13,
  },
  emptyTxt: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 40,
    lineHeight: 22,
  },
});