
import { useUser } from "@clerk/clerk-expo";
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';

import CommentModal from '../../components/CommentModal';
import LikeButton from '../../components/LikeButton';

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
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SERVER_BASE } from "../utils/config";
import {
  FALLBACK_WARDROBE,
  GeneratedOutfit,
  buildWardrobeFromItems,
  forceRegenerateOutfit,
  getOrCreateDailyOutfit,
} from "../utils/outfitEngine";

AsyncStorage.removeItem("fitsense_daily_outfit");

const PRIMARY = "#FF6B00";
const BG = "#000000";
const CHARCOAL = "#1A1A1A";
const WIDTH = Dimensions.get("window").width;
const DEFAULT_AVATAR =
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&q=80";


// ─── Daily Outfit – Week strip ────────────────────────────────────────────────
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const getWeekDates = () => {
  const today = new Date();
  const day = today.getDay(); // 0=Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((day + 6) % 7));
  return DAYS.map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      label,
      date: d.getDate(),
      isToday: d.toDateString() === today.toDateString(),
    };
  });
};



const FEED_ITEMS = [
  {
    id: "1",
    image:
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80",
    matchPercent: 98,
    username: "alexa_style",
    avatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&q=80",
    liked: true,
    caption:
      "Linen layers for the perfect summer afternoon. Minimalist, breathable, and timeless.",
    tag: "#QuietLuxury",
  },
  {
    id: "2",
    image:
      "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=600&q=80",
    matchPercent: 82,
    username: "marcus_fits",
    avatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80",
    liked: false,
    caption:
      "Tokyo street style vibes. Oversized is the only way to go this season.",
    tag: "#StreetCore",
  },
  {
    id: "3",
    image:
      "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=600&q=80",
    matchPercent: 90,
    username: "zoe.fits",
    avatar:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&q=80",
    liked: false,
    caption:
      "Monochrome palette, maximum impact. The art of wearing nothing but black.",
    tag: "#Monochrome",
  },
];

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

// ─── Color Display Map ────────────────────────────────────────────────────────
const COLOR_DISPLAY: Record<string, string> = {
  black: "#1A1A1A",
  white: "#F5F5F0",
  grey: "#888",
  gray: "#888",
  navy: "#1a3a6b",
  blue: "#2563EB",
  khaki: "#9E8B60",
  beige: "#D4C5A9",
  brown: "#8B5E3C",
  green: "#2D6A4F",
  red: "#C0392B",
  burgundy: "#7D1A3A",
  olive: "#6B7C3A",
  cream: "#F5ECD7",
  camel: "#C19A6B",
  charcoal: "#36454F",
  unknown: "#555",
};

// ─── Glass Panel ─────────────────────────────────────────────────────────────
function GlassPanel({
  children,
  style,
  intensity = 18,
  tint = "dark",
}: {
  children: React.ReactNode;
  style?: object;
  intensity?: number;
  tint?: "dark" | "light" | "default";
}) {
  return (
    <View style={[styles.glassPanelOuter, style]}>
      <BlurView
        intensity={intensity}
        tint={tint}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={["rgba(255,255,255,0.18)", "rgba(255,255,255,0.0)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.glassTopSheen}
      />
      <LinearGradient
        colors={["rgba(255,107,0,0.0)", "rgba(255,107,0,0.07)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.glassBottomGlow}
      />
      <View style={styles.glassBorder} />
      {children}
    </View>
  );
}

// ─── AI Feature Card ──────────────────────────────────────────────────────────
function AICard({
  icon,
  title,
  subtitle,
  accentColor,
  onPress,
}: {
  icon: string;
  title: string;
  subtitle: string;
  accentColor: string;
  onPress?: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () =>
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 30,
    }).start();
  const onPressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
    }).start();

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={onPress}
      style={{ flex: 1 }}
    >
      <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
        <GlassPanel style={styles.aiCard} intensity={22}>
          <View style={[styles.aiGlowOrb, { backgroundColor: accentColor }]} />
          <Text style={styles.aiCardIcon}>{icon}</Text>
          <Text style={styles.aiCardTitle}>{title}</Text>
          <Text style={styles.aiCardSubtitle}>{subtitle}</Text>
          <View
            style={[styles.aiCardChip, { borderColor: `${accentColor}55` }]}
          >
            <Text style={[styles.aiCardChipText, { color: accentColor }]}>
              Try now →
            </Text>
          </View>
        </GlassPanel>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Outfit Item Row ──────────────────────────────────────────────────────────
function OutfitItemRow({
  emoji,
  name,
  color,
  image,
  label,
  isLast,
}: {
  emoji: string;
  name: string;
  color: string;
  image?: string | null;
  label: string;
  isLast?: boolean;
}) {
  const dotColor = COLOR_DISPLAY[color] || "#555";

  return (
    <View style={[styles.outfitRow, !isLast && styles.outfitRowBorder]}>
      <View style={styles.outfitRowLeft}>
        <View style={styles.outfitEmojiBox}>
          {image ? (
            <Image
              source={{ uri: image }}
              style={{ width: 32, height: 32, resizeMode: "contain" }}
            />
          ) : (
            <Text style={styles.outfitEmoji}>{emoji}</Text>
          )}
        </View>

        <View>
          <Text style={styles.outfitLabel}>{label}</Text>
          <Text style={styles.outfitName}>{name}</Text>
        </View>
      </View>

      <View
        style={[
          styles.outfitColorDot,
          {
            backgroundColor: dotColor,
            borderColor: dotColor === "#F5F5F0" ? "#444" : dotColor,
          },
        ]}
      >
        <Text style={styles.outfitColorText}>
          {color !== "unknown" ? color : "–"}
        </Text>
      </View>
    </View>
  );
}

// ─── Day Outfit Card ─────────────────────────────────────────────────────────
const DAY_CARD_W = 150;
const DAY_HALF   = Math.floor(DAY_CARD_W / 2);
const DAY_IMG_H  = 120;

function DayOutfitCard({
  label,
  date,
  outfit,
  onPress,
}: {
  label: string;
  date: number;
  outfit?: any;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <View style={styles.dayCard}>

        {/* Split-panel image area */}
        {outfit ? (
          <View style={styles.dayPanels}>

            {/* LEFT — Top */}
            <View style={styles.dayPanelLeft}>
              {outfit.top?.image ? (
                <Image
                  source={{ uri: outfit.top.image }}
                  style={styles.dayPanelImg}
                  resizeMode="contain"
                />
              ) : (
                <Text style={styles.dayEmoji}>👕</Text>
              )}
              <View style={styles.dayPanelLabel}>
                <Text style={styles.dayPanelLabelTxt}>TOP</Text>
              </View>
            </View>

            <View style={styles.dayDivider} />

            {/* RIGHT — Bottom */}
            <View style={styles.dayPanelRight}>
              {outfit.bottom?.image ? (
                <Image
                  source={{ uri: outfit.bottom.image }}
                  style={styles.dayPanelImg}
                  resizeMode="contain"
                />
              ) : (
                <Text style={styles.dayEmoji}>👖</Text>
              )}
              <View style={styles.dayPanelLabel}>
                <Text style={styles.dayPanelLabelTxt}>BOT</Text>
              </View>
            </View>

          </View>
        ) : (
          <View style={styles.dayEmpty}>
            <Text style={styles.dayPlus}>+</Text>
          </View>
        )}

        {/* Day label strip */}
        <View style={styles.dayLabelStrip}>
          <Text style={styles.dayLabel}>{label}</Text>
          <Text style={styles.dayDate}>{date}</Text>
        </View>

      </View>
    </TouchableOpacity>
  );
}

// ─── Week Day Strip ───────────────────────────────────────────────────────────
function WeekDayChip({
  label,
  date,
  isToday,
}: {
  label: string;
  date: number;
  isToday: boolean;
}) {
  return (
    <View style={[styles.weekChip, isToday && styles.weekChipToday]}>
      <Text style={[styles.weekChipDay, isToday && { color: PRIMARY }]}>
        {label}
      </Text>
      <Text style={[styles.weekChipDate, isToday && { color: "#fff" }]}>
        {date}
      </Text>
    </View>
  );
}

// ─── Feed Card ────────────────────────────────────────────────────────────────
function FeedCardComponent({
  item,
  liked,
  onLike,
  likesCount = 0,
  commentsCount = 0,
  onCommentPress = () => {},
  saved = false,
  onSave = () => {},
}: {
  item: (typeof FEED_ITEMS)[0];
  liked: boolean;
  onLike: () => void;
  likesCount?: number;
  commentsCount?: number;
  onCommentPress?: () => void;
  saved?: boolean;
  onSave?: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.imageContainer}>
        <Image source={{ uri: item.image }} style={styles.cardImage} />
        <View style={styles.matchBadgeOuter}>
          <BlurView
            intensity={20}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={["rgba(255,255,255,0.14)", "rgba(255,255,255,0.03)"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.matchBadgeBorder} />
          <Text style={styles.matchStar}>✦</Text>
          <Text style={styles.matchText}>
            Sense Match:{" "}
            <Text style={{ color: PRIMARY }}>{item.matchPercent}%</Text>
          </Text>
        </View>
        <TouchableOpacity style={styles.expandBtnOuter}>
          <BlurView
            intensity={20}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={["rgba(255,255,255,0.14)", "rgba(255,255,255,0.03)"]}
            style={StyleSheet.absoluteFill}
          />
          <Text style={{ color: "#fff", fontSize: 16 }}>⛶</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.cardInfo}>
        <View style={styles.cardRow}>
          <View style={styles.userRow}>
            <Image source={{ uri: item.avatar }} style={styles.avatarSmall} />
            <Text style={styles.username}>{item.username}</Text>
          </View>
          <View style={styles.actions}>
            <LikeButton
              liked={liked}
              likesCount={likesCount}
              onPress={onLike}
              style={styles.actionBtn}
            />
            <TouchableOpacity
              onPress={onCommentPress}
              style={[styles.actionBtn, { paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 4 }]}
            >
              <Text style={{ fontSize: 20, color: "rgba(255,255,255,0.8)" }}>
                💬
              </Text>
              {commentsCount > 0 && (
                <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.9)", fontWeight: '600' }}>
                  {commentsCount}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={onSave}
              style={styles.actionBtn}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 20, color: saved ? PRIMARY : "rgba(255,255,255,0.5)" }}>
                🔖
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.caption}>
          {item.caption}{" "}
          <Text style={{ color: `${PRIMARY}cc` }}>{item.tag}</Text>
        </Text>
      </View>
    </View>
  );
}

const FeedCard = React.memo(FeedCardComponent);

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<"foryou" | "following">("foryou");
  const [likedItems, setLikedItems] = useState<Record<string, boolean>>({});
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [postsError, setPostsError] = useState<string | null>(null);
  const postsFetchInFlight = useRef(false);
  const [outfit, setOutfit] = useState<GeneratedOutfit | null>(null);
  const [outfitLoading, setOutfitLoading] = useState(true);
  const weekDates = useMemo(() => getWeekDates(), []);
  const { user, isLoaded } = useUser();
   const [savedOutfits, setSavedOutfits] = useState<any>({});
   
  // Comment modal state
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [savedItems, setSavedItems] = useState<Record<string, boolean>>({});
  const [persistedDataLoaded, setPersistedDataLoaded] = useState(false);

// Load liked and saved items from AsyncStorage
useEffect(() => {
  const loadPersistedData = async () => {
    if (!user?.id) {
      console.log('User not loaded yet, skipping load');
      return;
    }
    try {
      const likedKey = `fitsense_liked_${user?.id}`;
      const savedKey = `fitsense_saved_${user?.id}`;
      console.log('Loading persisted data from keys:', likedKey, savedKey);
      const likedJson = await AsyncStorage.getItem(likedKey);
      const savedJson = await AsyncStorage.getItem(savedKey);
      console.log('Loaded likedJson:', likedJson);
      console.log('Loaded savedJson:', savedJson);
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

// Persist liked items whenever they change (but only AFTER loading initial data)
useEffect(() => {
  if (!persistedDataLoaded) return; // Don't persist until data is loaded
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

// Persist saved items whenever they change (but only AFTER loading initial data)
useEffect(() => {
  if (!persistedDataLoaded) return; // Don't persist until data is loaded
  const persistSavedItems = async () => {
    try {
      const key = `fitsense_saved_${user?.id}`;
      console.log('Persisting saved items to key:', key, 'value:', savedItems);
      await AsyncStorage.setItem(key, JSON.stringify(savedItems));
      console.log('Successfully persisted saved items');
    } catch (e) {
      console.warn('Error saving saved items:', e);
    }
  };
  if (user?.id) persistSavedItems();
}, [savedItems, user?.id, persistedDataLoaded]);


  useEffect(() => {
    const loadSavedOutfits = async () => {
      const outfits: any = {};

      for (const d of weekDates) {
        const key = `fitsense_outfit_${d.label}_${d.date}`;
        const stored = await AsyncStorage.getItem(key);

        if (stored) {
          outfits[key] = JSON.parse(stored);
        }
      }

      setSavedOutfits(outfits);
    };

    loadSavedOutfits();
  }, [weekDates]);


  if (!isLoaded) {
    return null;
  }

  // Match Explore's mapping approach: use Clerk's profile image for avatar.
  // Note: we don't fetch other users by id here; we display the current user's pfp.
  const currentUserAvatar =
    (user?.unsafeMetadata as { profileImageUrl?: string } | undefined)
      ?.profileImageUrl ||
    user?.imageUrl ||
    DEFAULT_AVATAR;

  const currentUserName =
    user?.fullName ||
    (user?.unsafeMetadata as { name?: string } | undefined)?.name ||
    (user as any)?.primaryEmailAddress?.emailAddress ||
    "Unknown";

  const toggleLike = (id: string) =>
    setLikedItems((prev) => ({ ...prev, [id]: !prev[id] }));

  async function getAuthHeader(): Promise<string | null> {
    if (!user?.id) return null;
    // Use dev-token (works with current server verifyClerkToken)
    return `Bearer dev:${user.id}`;
  }

  async function fetchPosts() {
    if (postsFetchInFlight.current) return;
    postsFetchInFlight.current = true;
    try {
      setPostsError(null);
      if (!user?.id) {
        setPosts([]);
        return;
      }

      const authHeader = await getAuthHeader();
      if (!authHeader) {
        setPosts([]);
        return;
      }

      const endpoint =
        activeTab === "foryou" ? "/api/for-you" : "/api/for-you";
      const resp = await fetch(`${SERVER_BASE}${endpoint}`, {
        headers: { Authorization: authHeader },
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error((json as any)?.error || "Failed to load feed");

      const data = (json as any)?.posts ?? [];
      const normalized: Post[] = (data ?? []).map((p: any) => ({
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
      
      // Update likedItems map for local heart states from backend
      const newLikedMap: Record<string, boolean> = {};
      normalized.forEach(p => {
        if (p.liked) newLikedMap[p.id] = true;
      });
      setLikedItems(newLikedMap);
      
      setPosts(normalized);

      // Fetch like counts for all posts
      const postIds = normalized.map((p) => p.id);
      if (postIds.length > 0) {
        const likesResp = await fetch(
          `${SERVER_BASE}/api/posts/likes-count?${postIds.map((id) => `post_ids=${id}`).join("&")}`,
          {
            headers: { Authorization: authHeader },
          },
        );
        const likesJson = await likesResp.json().catch(() => ({}));
        if (likesResp.ok && likesJson.likeCounts) {
          setLikeCounts(likesJson.likeCounts);
        }
      }
    } catch (e) {
      console.error("fetchPosts error", e);
      const msg =
        (e as any)?.message ||
        (e as any)?.error_description ||
        (e as any)?.details ||
        String(e);
      setPostsError(msg);
      setPosts([]);
    } finally {
      postsFetchInFlight.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleLike(post_id: string) {
    const authHeader = await getAuthHeader();
    if (!authHeader || !user?.id) return;

    // optimistic UI (local heart state)
    setLikedItems((prev) => ({ ...prev, [post_id]: !prev[post_id] }));

    try {
      const resp = await fetch(`${SERVER_BASE}/api/like-toggle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({ post_id }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        console.error("LIKE ERROR:", json);
        throw new Error((json as any)?.error || "like-toggle failed");
      }

      // Optionally refetch feed so personalization kicks in immediately
      fetchPosts();
    } catch (e) {
      console.error("LIKE ERROR:", e);
      // revert optimistic toggle on failure
      setLikedItems((prev) => ({ ...prev, [post_id]: !prev[post_id] }));
    }
  }

  useEffect(() => {
    fetchPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, user?.id]);

  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    if (!user?.id) return;

    fetch(`${SERVER_BASE}/api/profile/wardrobe/${user.id}`)
      .then((res) => res.json())
      .then((data) => {
        const w = data?.wardrobe || {};
        const fetched: any[] = [];
        for (const key of Object.keys(w)) {
          const arr = Array.isArray(w[key]) ? w[key] : [];
          for (const item of arr) {
            fetched.push({
              id: item.id,
              image: item.image,
              category: item.category,
            });
          }
        }
        setItems(fetched);
      })
      .catch(() => {});
  }, [user]);

  const userWardrobe = useMemo(() => {
    if (items && items.length > 0) {
      return buildWardrobeFromItems(items);
    }
    return FALLBACK_WARDROBE;
  }, [items]);

  // Load or generate today's outfit on mount
  useEffect(() => {
    if (!items || items.length === 0) return;

    let cancelled = false;
    setOutfitLoading(true);

    const wardrobe = buildWardrobeFromItems(items);

    getOrCreateDailyOutfit(wardrobe, user?.id || undefined)
      .then((o) => {
        if (!cancelled) {
          setOutfit(o);
          setOutfitLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setOutfitLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [items, user?.id]);

  const handleRegenerate = () => {
    setOutfitLoading(true);
    forceRegenerateOutfit(userWardrobe, user?.id || undefined)
      .then((o) => {
        setOutfit(o);
        setOutfitLoading(false);
      })
      .catch(() => setOutfitLoading(false));
  };


    if (!isLoaded) {
    return null;
  }
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }} />
          <Text style={styles.logoText}>
            FIT<Text style={{ color: PRIMARY }}>SENSE</Text>
          </Text>
        </View>

        {/* For You / Following — liquid glass pill */}
        <View style={styles.toggleRow}>
          <View style={styles.toggleOuter}>
            <BlurView
              intensity={20}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={["rgba(255,255,255,0.13)", "rgba(255,255,255,0.04)"]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.toggleBorder} />
            <View style={styles.toggleInner}>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  activeTab === "foryou" && styles.toggleBtnActive,
                ]}
                onPress={() => setActiveTab("foryou")}
              >
                {activeTab === "foryou" && (
                  <LinearGradient
                    colors={[
                      "rgba(255,255,255,0.95)",
                      "rgba(255,255,255,0.85)",
                    ]}
                    style={StyleSheet.absoluteFill}
                  />
                )}
                <Text
                  style={[
                    styles.toggleText,
                    activeTab === "foryou" && styles.toggleTextActive,
                  ]}
                >
                  For You
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  activeTab === "following" && styles.toggleBtnActive,
                ]}
                onPress={() => setActiveTab("following")}
              >
                {activeTab === "following" && (
                  <LinearGradient
                    colors={[
                      "rgba(255,255,255,0.95)",
                      "rgba(255,255,255,0.85)",
                    ]}
                    style={StyleSheet.absoluteFill}
                  />
                )}
                <Text
                  style={[
                    styles.toggleText,
                    activeTab === "following" && styles.toggleTextActive,
                  ]}
                >
                  Following
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* ── Scrollable Body ── */}
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchPosts();
            }}
            tintColor="#fff"
          />
        }
      >
        {/* ── AI Tools Grid ── */}
        <View style={styles.sectionPad}>
          <Text style={styles.sectionLabel}>AI Tools</Text>
          <View style={styles.aiGrid}>
            <AICard
              icon="✦"
              title="Outfit Maker"
              subtitle="AI creates looks from your wardrobe"
              accentColor={PRIMARY}
              onPress={() =>
                router.push({
                  pathname: "../outfitMaker",
                  params: {
                    wardrobe: JSON.stringify(items),
                  },
                })
              }
            />
            <AICard
              icon="◈"
              title="Fashion Chat"
              subtitle="Style advice, anytime you need it"
              accentColor="#A78BFA"
            />
          </View>
        </View>

        {/* ── Weekly Planner ── */}
        <View style={styles.sectionPad}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Your Week</Text>
            <Text style={styles.sectionSub}>Planner</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12 }}
          >
            {weekDates.map((d, i) => {
              const key = `fitsense_outfit_${d.label}_${d.date}`;

              return (
                <DayOutfitCard
                  key={i}
                  label={d.label}
                  date={d.date}
                  outfit={savedOutfits[key]}
                  onPress={() =>
                    router.push({
                      pathname: "/dailyOutfit",
                      params: {
                        wardrobe: JSON.stringify(items),
                        day: d.label,
                        date: d.date,
                      },
                    })
                  }
                />
              );
            })}
          </ScrollView>
        </View>

        {/* ── Feed ── */}
        <View style={styles.sectionPad}>
          <Text style={styles.sectionLabel}>Trending Fits</Text>
          {loading ? (
            <View style={{ paddingVertical: 24, alignItems: "center" }}>
              <ActivityIndicator color="#fff" />
            </View>
          ) : postsError ? (
            <View style={{ paddingVertical: 16 }}>
              <Text style={{ color: "rgba(255,255,255,0.55)" }}>
                Couldn't load posts. Pull to refresh.
              </Text>
            </View>
          ) : posts.length === 0 ? (
            <View style={{ paddingVertical: 16 }}>
              <Text style={{ color: "rgba(255,255,255,0.55)" }}>
                No posts yet. Pull to refresh.
              </Text>
            </View>
          ) : (
            posts.map((p: any) => {
              const owner = p.owner_profile || {};
              const isPostLiked = !!likedItems[p.id];

              const derivedItem = {
                id: p.id,
                image: p.image_url,
                matchPercent: typeof p.score === 'number' ? p.score : 0,
                username: owner.username || (p.owner_clerk_id === user?.id ? currentUserName : "Unknown"),
                avatar: owner.profile_image_url || (p.owner_clerk_id === user?.id ? currentUserAvatar : DEFAULT_AVATAR),
                liked: isPostLiked,
                caption: p.caption ?? "",
                tag: p.tags?.[0] ? `#${p.tags[0]}` : "",
              } as (typeof FEED_ITEMS)[0];

              return (
                <FeedCard
                  key={p.id}
                  item={derivedItem}
                  liked={isPostLiked}
                  onLike={() => handleLike(p.id)}
                  likesCount={likeCounts[p.id] || 0}
                  commentsCount={p.comments_count || 0}
                  onCommentPress={() => {
                    setSelectedPostId(p.id);
                    setCommentModalVisible(true);
                  }}
                  saved={!!savedItems[p.id]}
                  onSave={() => {
                    setSavedItems((prev) => {
                      const newState = { ...prev, [p.id]: !prev[p.id] };
                      return newState;
                    });
                  }}
                />
              );
            })
          )}
        </View>
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push("/create-post")}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

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
  container: { flex: 1, backgroundColor: BG },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    marginBottom: 16,
  },
  logoText: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 3,
    fontFamily: Platform.OS === "ios" ? "SF Pro Display" : undefined,
  },

  // Toggle
  toggleRow: { alignItems: "center", marginBottom: 4 },
  toggleOuter: {
    flexDirection: "row",
    borderRadius: 999,
    overflow: "hidden",
    width: 220,
    height: 38,
    position: "relative",
  },
  toggleBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.18)",
  },
  toggleInner: { flexDirection: "row", flex: 1, padding: 3, zIndex: 2 },
  toggleBtn: {
    flex: 1,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  toggleBtnActive: {},
  toggleText: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.45)",
    zIndex: 1,
  },
  toggleTextActive: { color: "#000", fontWeight: "700" },

  // Scroll
  scroll: { flex: 1 },
  sectionPad: { paddingHorizontal: 16, marginBottom: 8 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 14,
    letterSpacing: 0.2,
  },
  sectionLabelSmall: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(255,255,255,0.5)",
    marginBottom: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  sectionSub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.35)",
    fontWeight: "500",
  },

  // AI Grid
  aiGrid: { flexDirection: "row", gap: 12 },
  aiCard: {
    borderRadius: 24,
    padding: 18,
    minHeight: 160,
    overflow: "hidden",
    position: "relative",
  },
  aiGlowOrb: {
    position: "absolute",
    top: -30,
    right: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    opacity: 0.12,
  },
  aiCardIcon: { fontSize: 28, marginBottom: 10, color: "#fff" },
  aiCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 5,
  },
  aiCardSubtitle: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    lineHeight: 16,
    marginBottom: 14,
  },
  aiCardChip: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  aiCardChipText: { fontSize: 11, fontWeight: "600" },

  // Glass Panel shared
  glassPanelOuter: { overflow: "hidden", position: "relative" },
  glassTopSheen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 48,
    zIndex: 0,
  },
  glassBottomGlow: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 56,
    zIndex: 0,
  },
  glassBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.16)",
  },

  // Today's Outfit Card
  outfitCard: { borderRadius: 24, overflow: "hidden", position: "relative" },
  outfitCardTopStrip: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    zIndex: 0,
  },
  outfitCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    zIndex: 1,
  },
  outfitCardTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  outfitCardTitleDot: { color: PRIMARY, fontSize: 8 },
  outfitCardTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  outfitCardDate: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 3,
  },
  regenBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,107,0,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,107,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  regenIcon: { color: PRIMARY, fontSize: 20, fontWeight: "700" },
  outfitDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.07)",
    marginHorizontal: 20,
    marginBottom: 8,
  },
  outfitItemsContainer: { paddingHorizontal: 16, paddingBottom: 4 },

  // Outfit Item Row
  outfitRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  outfitRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  outfitRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },
  outfitEmojiBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  outfitEmoji: { fontSize: 22 },
  outfitLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(255,255,255,0.35)",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 2,
  },
  outfitName: { color: "#fff", fontSize: 14, fontWeight: "700", flex: 1 },
  outfitColorDot: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 52,
  },
  outfitColorText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fff",
    textTransform: "capitalize",
  },

  // Loading state
  outfitLoadingBox: { paddingVertical: 36, alignItems: "center", gap: 12 },
  outfitLoadingIcon: { fontSize: 28, color: PRIMARY },
  outfitLoadingText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    fontWeight: "500",
  },

  // Outfit footer
  outfitFooter: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: "center",
  },
  aiBadge: {
    backgroundColor: "rgba(255,107,0,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,107,0,0.25)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  aiBadgeText: {
    color: PRIMARY,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  // Week Strip
  weekRow: { gap: 8, paddingBottom: 8 },
  weekChip: {
    width: 48,
    height: 60,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  weekChipToday: {
    backgroundColor: "rgba(255,107,0,0.12)",
    borderColor: "rgba(255,107,0,0.4)",
  },
  weekChipDay: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  weekChipDate: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 16,
    fontWeight: "800",
  },

  // Feed
  card: { marginBottom: 36 },
  imageContainer: {
    aspectRatio: 3 / 4,
    borderRadius: 28,
    overflow: "hidden",
    marginBottom: 16,
    position: "relative",
  },
  cardImage: { width: "100%", height: "100%", resizeMode: "cover" },
  matchBadgeOuter: {
    position: "absolute",
    top: 16,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  matchBadgeBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.22)",
  },
  matchStar: { color: PRIMARY, fontSize: 13 },
  matchText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  expandBtnOuter: {
    position: "absolute",
    bottom: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  cardInfo: { paddingHorizontal: 8 },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  userRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  username: { color: "#fff", fontSize: 14, fontWeight: "700" },
  actions: { flexDirection: "row", alignItems: "center", gap: 18 },
  actionBtn: { padding: 8, borderRadius: 8, minWidth: 40, alignItems: 'center', justifyContent: 'center' },
  caption: { color: 'rgba(255,255,255,0.65)', fontSize: 13, lineHeight: 20, fontWeight: '400' },

  // ── Day Card — split panel ─────────────────────────────────────────────────
  dayCard: {
    width: DAY_CARD_W,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  dayPanels: {
    flexDirection: "row",
    height: DAY_IMG_H,
    overflow: "hidden",
  },
  dayPanelLeft: {
    width: DAY_HALF,
    height: DAY_IMG_H,
    backgroundColor: "#EDE8E2",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  dayPanelRight: {
    width: DAY_HALF,
    height: DAY_IMG_H,
    backgroundColor: "#E8E3DC",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  dayPanelImg: {
    width: DAY_HALF,
    height: DAY_IMG_H - 18,
  },
  dayPanelLabel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 16,
    backgroundColor: "rgba(235,230,222,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  dayPanelLabelTxt: {
    fontSize: 7,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: "#7A6A5A",
  },
  dayDivider: {
    width: StyleSheet.hairlineWidth,
    height: DAY_IMG_H,
    backgroundColor: "#C8BFB5",
  },
  dayEmpty: {
    height: DAY_IMG_H,
    backgroundColor: "#1A1A1A",
    alignItems: "center",
    justifyContent: "center",
  },
  dayEmoji: { fontSize: 28 },
  dayPlus: { color: PRIMARY, fontSize: 28, fontWeight: "700" },

  // ✅ FIXED: dayLabelStrip now properly closed, dayLabel is its own key
  dayLabelStrip: {
    backgroundColor: "#111",
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dayLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    fontWeight: "600",
  },
  dayDate: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },

  addCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,107,0,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,107,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  addPlus: {
    color: "#FF6B00",
    fontSize: 24,
    fontWeight: "700",
  },
  outfitStack: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  outfitImage: {
    width: 40,
    height: 40,
    resizeMode: "contain",
  },

  // FAB
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 999,
  },
  fabIcon: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "600",
    marginTop: -2,
  },
});