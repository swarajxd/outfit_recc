import { Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";

const { width: W, height: H } = Dimensions.get("window");

// ─── Tokens ───────────────────────────────────────────────────────────────────
const BG        = "#08080A";
const SURFACE   = "#111114";
const SURFACE_2 = "#1A1A1F";
const BORDER    = "rgba(255,255,255,0.07)";
const PRIMARY   = "#FF4D00";
const GOLD      = "#D4A853";
const TEXT      = "#F2EEE9";
const MUTED     = "rgba(242,238,233,0.45)";
const FAINT     = "rgba(242,238,233,0.18)";

// ─── Animated heart button ────────────────────────────────────────────────────
function HeartButton() {
  const [liked, setLiked] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  const handlePress = () => {
    setLiked((v) => !v);
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, { toValue: 1.45, useNativeDriver: true, speed: 50 }),
        Animated.timing(rotate, { toValue: liked ? 0 : 1, duration: 140, useNativeDriver: true }),
      ]),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
    ]).start();
  };

  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-15deg"] });

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.9}>
      <Animated.View style={{ transform: [{ scale }, { rotate: spin }] }}>
        <Ionicons
          name={liked ? "heart" : "heart-outline"}
          size={27}
          color={liked ? PRIMARY : TEXT}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Bookmark button ──────────────────────────────────────────────────────────
function BookmarkButton() {
  const [saved, setSaved] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    setSaved((v) => !v);
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.35, useNativeDriver: true, speed: 50 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
    ]).start();
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.9}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Feather name={saved ? "bookmark" : "bookmark"} size={24} color={saved ? GOLD : TEXT} />
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Tag pill ──────────────────────────────────────────────────────────────────
function TagPill({ label }: { label: string }) {
  return (
    <View style={styles.tagPill}>
      <Text style={styles.tagText}>{label}</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function PostScreen() {
  const router = useRouter();
  const scrollY = useRef(new Animated.Value(0)).current;

  // Parallax: image moves slightly slower than scroll
  const imageTranslate = scrollY.interpolate({
    inputRange: [-H, 0, H * 0.6],
    outputRange: [-60, 0, 80],
    extrapolate: "clamp",
  });

  // Header fades in as user scrolls
  const stickyHeaderOpacity = scrollY.interpolate({
    inputRange: [320, 400],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* ── Sticky top bar (appears on scroll) ── */}
      <Animated.View
        style={[
          styles.stickyHeader,
          { opacity: stickyHeaderOpacity },
        ]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={["rgba(8,8,10,0.98)", "transparent"]}
          style={StyleSheet.absoluteFillObject}
        />
        <Text style={styles.stickyTitle}>youraccount</Text>
      </Animated.View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        {/* ── Hero image with parallax ── */}
        <View style={styles.heroContainer}>
          <Animated.Image
            source={require("../assets/img2.jpg")}
            style={[styles.heroImage, { transform: [{ translateY: imageTranslate }] }]}
          />

          {/* Top gradient — for header legibility */}
          <LinearGradient
            colors={["rgba(8,8,10,0.75)", "transparent"]}
            style={styles.heroTopGradient}
          />

          {/* Bottom gradient — blends into content */}
          <LinearGradient
            colors={["transparent", "rgba(8,8,10,0.6)", BG]}
            style={styles.heroBottomGradient}
          />

          {/* ── Floating header ── */}
          <SafeAreaView style={styles.floatingHeader}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
              activeOpacity={0.8}
            >
              <Ionicons name="chevron-back" size={20} color={TEXT} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.moreBtn} activeOpacity={0.8}>
              <Feather name="more-horizontal" size={20} color={TEXT} />
            </TouchableOpacity>
          </SafeAreaView>

          {/* ── Issue / editorial label ── */}
          <View style={styles.editorialBadge}>
            <View style={styles.editorialDot} />
            <Text style={styles.editorialText}>FEATURED FIT</Text>
          </View>
        </View>

        {/* ── Content card ── */}
        <View style={styles.contentCard}>

          {/* ── User row ── */}
          <View style={styles.userRow}>
            <View style={styles.avatarWrap}>
              <Image
                source={require("../assets/img1.jpg")}
                style={styles.avatar}
              />
              <LinearGradient
                colors={[PRIMARY, GOLD]}
                style={styles.avatarRing}
              />
            </View>

            <View style={styles.userInfo}>
              <Text style={styles.username}>youraccount</Text>
              <View style={styles.locationRow}>
                <Ionicons name="location-sharp" size={10} color={PRIMARY} />
                <Text style={styles.location}>Location Here</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.followBtn} activeOpacity={0.85}>
              <Text style={styles.followText}>Follow</Text>
            </TouchableOpacity>
          </View>

          {/* ── Divider ── */}
          <View style={styles.divider} />

          {/* ── Stats row ── */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>12.8K</Text>
              <Text style={styles.statLabel}>Likes</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>348</Text>
              <Text style={styles.statLabel}>Comments</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>2.1K</Text>
              <Text style={styles.statLabel}>Saves</Text>
            </View>
          </View>

          {/* ── Action row ── */}
          <View style={styles.actionRow}>
            <View style={styles.leftActions}>
              <HeartButton />
              <TouchableOpacity activeOpacity={0.8}>
                <Ionicons name="chatbubble-outline" size={25} color={TEXT} />
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.8}>
                <Feather name="send" size={23} color={TEXT} />
              </TouchableOpacity>
            </View>
            <BookmarkButton />
          </View>

          {/* ── Caption ── */}
          <View style={styles.captionBlock}>
            <Text style={styles.caption}>
              Enhance your Instagram with our UI Mockup Download for Instagram creativity. Minimal layering, tonal dressing — less is always more.{" "}
              <Text style={styles.captionHashtag}>#OOTD #MinimalFashion #FitCheck</Text>
            </Text>
          </View>

          {/* ── Style tags ── */}
          <View style={styles.tagsRow}>
            <TagPill label="Minimalist" />
            <TagPill label="Monochrome" />
            <TagPill label="SS25" />
            <TagPill label="Editorial" />
          </View>

          {/* ── Comments preview ── */}
          <View style={styles.commentsSection}>
            <View style={styles.commentsSectionHeader}>
              <Text style={styles.commentsSectionTitle}>Comments</Text>
              <TouchableOpacity>
                <Text style={styles.viewAll}>View all 348</Text>
              </TouchableOpacity>
            </View>

            {[
              { user: "janedoe__", text: "obsessed with this fit 🖤", time: "2h" },
              { user: "style.archive", text: "the tonal layering is everything", time: "5h" },
            ].map((c, i) => (
              <View key={i} style={styles.commentRow}>
                <View style={styles.commentAvatar}>
                  <Text style={{ fontSize: 14 }}>👤</Text>
                </View>
                <View style={styles.commentBody}>
                  <Text style={styles.commentUser}>{c.user}</Text>
                  <Text style={styles.commentText}>{c.text}</Text>
                </View>
                <Text style={styles.commentTime}>{c.time}</Text>
              </View>
            ))}
          </View>

          {/* ── Bottom spacer ── */}
          <View style={{ height: 60 }} />
        </View>
      </Animated.ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },

  // ── Sticky header
  stickyHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 99,
    paddingTop: 52,
    paddingBottom: 14,
    alignItems: "center",
  },
  stickyTitle: {
    color: TEXT,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  // ── Hero
  heroContainer: {
    height: H * 0.62,
    overflow: "hidden",
    backgroundColor: SURFACE,
  },
  heroImage: {
    width: W,
    height: H * 0.72,
    resizeMode: "cover",
    position: "absolute",
    top: -40,
  },
  heroTopGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 140,
  },
  heroBottomGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 180,
  },

  // ── Floating header
  floatingHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: "rgba(8,8,10,0.55)",
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  moreBtn: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: "rgba(8,8,10,0.55)",
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Editorial badge
  editorialBadge: {
    position: "absolute",
    bottom: 28,
    left: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(8,8,10,0.6)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  editorialDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: PRIMARY,
  },
  editorialText: {
    color: TEXT,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 2,
  },

  // ── Content card
  contentCard: {
    backgroundColor: BG,
    marginTop: -2,
    paddingTop: 4,
  },

  // ── User row
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 4,
    gap: 12,
  },
  avatarWrap: {
    position: "relative",
    width: 50,
    height: 50,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    position: "absolute",
    top: 3,
    left: 3,
  },
  avatarRing: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 50,
    height: 50,
    borderRadius: 16,
    opacity: 0.85,
    // acts as border by being slightly larger
    zIndex: -1,
  },
  userInfo: {
    flex: 1,
    gap: 3,
  },
  username: {
    color: TEXT,
    fontWeight: "800",
    fontSize: 15,
    letterSpacing: -0.2,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  location: {
    color: MUTED,
    fontSize: 11,
    fontWeight: "600",
  },
  followBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 11,
    backgroundColor: PRIMARY,
  },
  followText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.4,
  },

  // ── Divider
  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginHorizontal: 18,
    marginTop: 16,
    marginBottom: 0,
  },

  // ── Stats
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  statValue: {
    color: TEXT,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  statLabel: {
    color: MUTED,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: BORDER,
  },

  // ── Actions
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER,
  },
  leftActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },

  // ── Caption
  captionBlock: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 4,
  },
  caption: {
    color: MUTED,
    fontSize: 13,
    lineHeight: 21,
    fontWeight: "500",
  },
  captionHashtag: {
    color: PRIMARY,
    fontWeight: "700",
  },

  // ── Tags
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 18,
    paddingTop: 12,
    gap: 8,
  },
  tagPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: SURFACE_2,
    borderWidth: 1,
    borderColor: BORDER,
  },
  tagText: {
    color: FAINT,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  // ── Comments
  commentsSection: {
    paddingHorizontal: 18,
    marginTop: 22,
  },
  commentsSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  commentsSectionTitle: {
    color: TEXT,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  viewAll: {
    color: PRIMARY,
    fontSize: 12,
    fontWeight: "700",
  },
  commentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 14,
  },
  commentAvatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: SURFACE_2,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  commentBody: {
    flex: 1,
    gap: 3,
  },
  commentUser: {
    color: TEXT,
    fontSize: 12,
    fontWeight: "800",
  },
  commentText: {
    color: MUTED,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  commentTime: {
    color: FAINT,
    fontSize: 11,
    fontWeight: "600",
    paddingTop: 1,
  },
});