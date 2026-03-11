import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FALLBACK_WARDROBE,
  GeneratedOutfit,
  forceRegenerateOutfit,
  getOrCreateDailyOutfit,
} from '../utils/outfitEngine';

const PRIMARY = '#FF6B00';
const BG = '#000000';
const CHARCOAL = '#1A1A1A';
const WIDTH = Dimensions.get('window').width;

// ─── Daily Outfit – Week strip ────────────────────────────────────────────────
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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
    id: '1',
    image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80',
    matchPercent: 98,
    username: 'alexa_style',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&q=80',
    liked: true,
    caption: 'Linen layers for the perfect summer afternoon. Minimalist, breathable, and timeless.',
    tag: '#QuietLuxury',
  },
  {
    id: '2',
    image: 'https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=600&q=80',
    matchPercent: 82,
    username: 'marcus_fits',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80',
    liked: false,
    caption:
      "Tokyo street style vibes. Oversized is the only way to go this season.",
    tag: "#StreetCore",
  },
  {
    id: '3',
    image: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=600&q=80',
    matchPercent: 90,
    username: 'zoe.fits',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&q=80',
    liked: false,
    caption:
      "Monochrome palette, maximum impact. The art of wearing nothing but black.",
    tag: "#Monochrome",
  },
];

// ─── Color Display Map ────────────────────────────────────────────────────────
const COLOR_DISPLAY: Record<string, string> = {
  black: '#1A1A1A', white: '#F5F5F0', grey: '#888', gray: '#888',
  navy: '#1a3a6b', blue: '#2563EB', khaki: '#9E8B60', beige: '#D4C5A9',
  brown: '#8B5E3C', green: '#2D6A4F', red: '#C0392B', burgundy: '#7D1A3A',
  olive: '#6B7C3A', cream: '#F5ECD7', camel: '#C19A6B', charcoal: '#36454F',
  unknown: '#555',
};

// ─── Glass Panel ─────────────────────────────────────────────────────────────
function GlassPanel({
  children,
  style,
  intensity = 18,
  tint = 'dark',
}: {
  children: React.ReactNode;
  style?: object;
  intensity?: number;
  tint?: 'dark' | 'light' | 'default';
}) {
  return (
    <View style={[styles.glassPanelOuter, style]}>
      <BlurView intensity={intensity} tint={tint} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.glassTopSheen}
      />
      <LinearGradient
        colors={['rgba(255,107,0,0.0)', 'rgba(255,107,0,0.07)']}
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
  icon, title, subtitle, accentColor, onPress,
}: {
  icon: string; title: string; subtitle: string; accentColor: string; onPress?: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 30 }).start();
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20 }).start();

  return (
    <TouchableOpacity activeOpacity={1} onPressIn={onPressIn} onPressOut={onPressOut} onPress={onPress} style={{ flex: 1 }}>
      <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
        <GlassPanel style={styles.aiCard} intensity={22}>
          <View style={[styles.aiGlowOrb, { backgroundColor: accentColor }]} />
          <Text style={styles.aiCardIcon}>{icon}</Text>
          <Text style={styles.aiCardTitle}>{title}</Text>
          <Text style={styles.aiCardSubtitle}>{subtitle}</Text>
          <View style={[styles.aiCardChip, { borderColor: `${accentColor}55` }]}>
            <Text style={[styles.aiCardChipText, { color: accentColor }]}>Try now →</Text>
          </View>
        </GlassPanel>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Outfit Item Row ──────────────────────────────────────────────────────────
function OutfitItemRow({
  emoji, name, color, label, isLast,
}: {
  emoji: string; name: string; color: string; label: string; isLast?: boolean;
}) {
  const dotColor = COLOR_DISPLAY[color] || '#555';
  return (
    <View style={[styles.outfitRow, !isLast && styles.outfitRowBorder]}>
      <View style={styles.outfitRowLeft}>
        <View style={styles.outfitEmojiBox}>
          <Text style={styles.outfitEmoji}>{emoji}</Text>
        </View>
        <View>
          <Text style={styles.outfitLabel}>{label}</Text>
          <Text style={styles.outfitName}>{name}</Text>
        </View>
      </View>
      <View style={[styles.outfitColorDot, { backgroundColor: dotColor, borderColor: dotColor === '#F5F5F0' ? '#444' : dotColor }]}>
        <Text style={styles.outfitColorText}>{color !== 'unknown' ? color : '–'}</Text>
      </View>
    </View>
  );
}

// ─── Today's Outfit Card ──────────────────────────────────────────────────────
function TodayOutfitCard({
  outfit, onRegenerate, loading,
}: {
  outfit: GeneratedOutfit | null; onRegenerate: () => void; loading: boolean;
}) {
  const spinAnim = useRef(new Animated.Value(0)).current;

  const startSpin = () => {
    spinAnim.setValue(0);
    Animated.timing(spinAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  };

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleRegen = () => {
    startSpin();
    onRegenerate();
  };

  const today = new Date();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dateStr = `${dayNames[today.getDay()]}, ${monthNames[today.getMonth()]} ${today.getDate()}`;

  if (loading || !outfit) {
    return (
      <GlassPanel style={styles.outfitCard} intensity={24}>
        <View style={styles.outfitCardHeader}>
          <View>
            <Text style={styles.outfitCardTitle}>Today's Outfit</Text>
            <Text style={styles.outfitCardDate}>{dateStr}</Text>
          </View>
        </View>
        <View style={styles.outfitLoadingBox}>
          <Text style={styles.outfitLoadingIcon}>✦</Text>
          <Text style={styles.outfitLoadingText}>
            {loading ? 'Generating your outfit...' : 'No outfit yet'}
          </Text>
        </View>
      </GlassPanel>
    );
  }

  const items = [
    { emoji: outfit.top.emoji, name: outfit.top.name, color: outfit.top.color, label: 'Top' },
    { emoji: outfit.bottom.emoji, name: outfit.bottom.name, color: outfit.bottom.color, label: 'Bottom' },
    { emoji: outfit.footwear.emoji, name: outfit.footwear.name, color: outfit.footwear.color, label: 'Footwear' },
    ...(outfit.outerwear ? [{ emoji: outfit.outerwear.emoji, name: outfit.outerwear.name, color: outfit.outerwear.color, label: 'Layer' }] : []),
    ...(outfit.accessory ? [{ emoji: outfit.accessory.emoji, name: outfit.accessory.name, color: outfit.accessory.color, label: 'Accessory' }] : []),
  ];

  return (
    <GlassPanel style={styles.outfitCard} intensity={24}>
      {/* Orange gradient top strip */}
      <LinearGradient
        colors={['rgba(255,107,0,0.18)', 'rgba(255,107,0,0.0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.outfitCardTopStrip}
      />

      {/* Header */}
      <View style={styles.outfitCardHeader}>
        <View>
          <View style={styles.outfitCardTitleRow}>
            <Text style={styles.outfitCardTitleDot}>●</Text>
            <Text style={styles.outfitCardTitle}>Today's Outfit</Text>
          </View>
          <Text style={styles.outfitCardDate}>{dateStr}</Text>
        </View>
        <TouchableOpacity onPress={handleRegen} style={styles.regenBtn} activeOpacity={0.7}>
          <Animated.Text style={[styles.regenIcon, { transform: [{ rotate: spin }] }]}>↻</Animated.Text>
        </TouchableOpacity>
      </View>

      {/* Divider */}
      <View style={styles.outfitDivider} />

      {/* Outfit items */}
      <View style={styles.outfitItemsContainer}>
        {items.map((item, idx) => (
          <OutfitItemRow
            key={`${item.label}-${idx}`}
            emoji={item.emoji}
            name={item.name}
            color={item.color}
            label={item.label}
            isLast={idx === items.length - 1}
          />
        ))}
      </View>

      {/* Footer badge */}
      <View style={styles.outfitFooter}>
        <View style={styles.aiBadge}>
          <Text style={styles.aiBadgeText}>✦ AI Matched · Color Harmony</Text>
        </View>
      </View>
    </GlassPanel>
  );
}

// ─── Week Day Strip ───────────────────────────────────────────────────────────
function WeekDayChip({
  label, date, isToday,
}: {
  label: string; date: number; isToday: boolean;
}) {
  return (
    <View style={[styles.weekChip, isToday && styles.weekChipToday]}>
      <Text style={[styles.weekChipDay, isToday && { color: PRIMARY }]}>{label}</Text>
      <Text style={[styles.weekChipDate, isToday && { color: '#fff' }]}>{date}</Text>
    </View>
  );
}

// ─── Feed Card ────────────────────────────────────────────────────────────────
function FeedCard({
  item, liked, onLike,
}: {
  item: (typeof FEED_ITEMS)[0]; liked: boolean; onLike: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.imageContainer}>
        <Image source={{ uri: item.image }} style={styles.cardImage} />
        <View style={styles.matchBadgeOuter}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.03)']} style={StyleSheet.absoluteFill} />
          <View style={styles.matchBadgeBorder} />
          <Text style={styles.matchStar}>✦</Text>
          <Text style={styles.matchText}>
            Sense Match: <Text style={{ color: PRIMARY }}>{item.matchPercent}%</Text>
          </Text>
        </View>
        <TouchableOpacity style={styles.expandBtnOuter}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.03)']} style={StyleSheet.absoluteFill} />
          <Text style={{ color: '#fff', fontSize: 16 }}>⛶</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.cardInfo}>
        <View style={styles.cardRow}>
          <View style={styles.userRow}>
            <Image source={{ uri: item.avatar }} style={styles.avatarSmall} />
            <Text style={styles.username}>{item.username}</Text>
          </View>
          <View style={styles.actions}>
            <TouchableOpacity onPress={onLike} style={styles.actionBtn}>
              <Text
                style={{
                  fontSize: 22,
                  color: liked ? PRIMARY : "rgba(255,255,255,0.8)",
                }}
              >
                {liked ? "♥" : "♡"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn}>
              <Text style={{ fontSize: 20, color: "rgba(255,255,255,0.8)" }}>
                💬
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn}>
              <Text style={{ fontSize: 20, color: "rgba(255,255,255,0.8)" }}>
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

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'foryou' | 'following'>('foryou');
  const [likedItems, setLikedItems] = useState<Record<string, boolean>>({ '1': true });
  const [outfit, setOutfit] = useState<GeneratedOutfit | null>(null);
  const [outfitLoading, setOutfitLoading] = useState(true);
  const weekDates = getWeekDates();

  const toggleLike = (id: string) =>
    setLikedItems((prev) => ({ ...prev, [id]: !prev[id] }));

  // Load or generate today's outfit on mount
  useEffect(() => {
    let cancelled = false;
    setOutfitLoading(true);
    getOrCreateDailyOutfit(FALLBACK_WARDROBE)
      .then((o) => { if (!cancelled) { setOutfit(o); setOutfitLoading(false); } })
      .catch(() => { if (!cancelled) setOutfitLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleRegenerate = () => {
    setOutfitLoading(true);
    forceRegenerateOutfit(FALLBACK_WARDROBE)
      .then((o) => { setOutfit(o); setOutfitLoading(false); })
      .catch(() => setOutfitLoading(false));
  };

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
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={['rgba(255,255,255,0.13)', 'rgba(255,255,255,0.04)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.toggleBorder} />
            <View style={styles.toggleInner}>
              <TouchableOpacity
                style={[styles.toggleBtn, activeTab === 'foryou' && styles.toggleBtnActive]}
                onPress={() => setActiveTab('foryou')}
              >
                {activeTab === 'foryou' && (
                  <LinearGradient
                    colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.85)']}
                    style={StyleSheet.absoluteFill}
                  />
                )}
                <Text style={[styles.toggleText, activeTab === 'foryou' && styles.toggleTextActive]}>
                  For You
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, activeTab === 'following' && styles.toggleBtnActive]}
                onPress={() => setActiveTab('following')}
              >
                {activeTab === 'following' && (
                  <LinearGradient
                    colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.85)']}
                    style={StyleSheet.absoluteFill}
                  />
                )}
                <Text style={[styles.toggleText, activeTab === 'following' && styles.toggleTextActive]}>
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
            />
            <AICard
              icon="◈"
              title="Fashion Chat"
              subtitle="Style advice, anytime you need it"
              accentColor="#A78BFA"
            />
          </View>
        </View>

        {/* ── Today's Outfit Card ── */}
        <View style={styles.sectionPad}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Daily Outfit</Text>
            <Text style={styles.sectionSub}>Rule-based matching</Text>
          </View>
          <TodayOutfitCard
            outfit={outfit}
            onRegenerate={handleRegenerate}
            loading={outfitLoading}
          />
        </View>

        {/* ── Week Strip ── */}
        <View style={styles.sectionPad}>
          <Text style={styles.sectionLabelSmall}>This Week</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.weekRow}
          >
            {weekDates.map((d) => (
              <WeekDayChip key={d.label} label={d.label} date={d.date} isToday={d.isToday} />
            ))}
          </ScrollView>
        </View>

        {/* ── Feed ── */}
        <View style={styles.sectionPad}>
          <Text style={styles.sectionLabel}>Trending Fits</Text>
          {FEED_ITEMS.map((item) => (
            <FeedCard
              key={item.id}
              item={item}
              liked={!!likedItems[item.id]}
              onLike={() => toggleLike(item.id)}
            />
          ))}
        </View>
      </ScrollView>
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
  paddingBottom: 10 
},
headerRow: {
  flexDirection: 'row', 
  alignItems: 'center',
  justifyContent: 'flex-start',  // ✅ logo stays left
  marginBottom: 16,
},
logoText: {
  fontSize: 22, 
  fontWeight: '800', 
  color: '#fff', 
  letterSpacing: 3,
  fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : undefined,
},

  // Toggle
  toggleRow: { alignItems: 'center', marginBottom: 4 },
  toggleOuter: {
    flexDirection: 'row', borderRadius: 999, overflow: 'hidden',
    width: 220, height: 38, position: 'relative',
  },
  toggleBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.18)',
  },
  toggleInner: { flexDirection: 'row', flex: 1, padding: 3, zIndex: 2 },
  toggleBtn: {
    flex: 1, borderRadius: 999, alignItems: 'center',
    justifyContent: 'center', overflow: 'hidden', position: 'relative',
  },
  toggleBtnActive: {},
  toggleText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.45)', zIndex: 1 },
  toggleTextActive: { color: '#000', fontWeight: '700' },

  // Scroll
  scroll: { flex: 1 },
  sectionPad: { paddingHorizontal: 16, marginBottom: 8 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'baseline',
    justifyContent: 'space-between', marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 17, fontWeight: '700', color: '#fff',
    marginBottom: 14, letterSpacing: 0.2,
  },
  sectionLabelSmall: {
    fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.5)',
    marginBottom: 10, letterSpacing: 1, textTransform: 'uppercase',
  },
  sectionSub: { fontSize: 13, color: 'rgba(255,255,255,0.35)', fontWeight: '500' },

  // AI Grid
  aiGrid: { flexDirection: 'row', gap: 12 },
  aiCard: {
    borderRadius: 24, padding: 18, minHeight: 160,
    overflow: 'hidden', position: 'relative',
  },
  aiGlowOrb: {
    position: 'absolute', top: -30, right: -30,
    width: 100, height: 100, borderRadius: 50, opacity: 0.12,
  },
  aiCardIcon: { fontSize: 28, marginBottom: 10, color: '#fff' },
  aiCardTitle: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 5 },
  aiCardSubtitle: {
    fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 16, marginBottom: 14,
  },
  aiCardChip: {
    alignSelf: 'flex-start', borderWidth: 1,
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4,
  },
  aiCardChipText: { fontSize: 11, fontWeight: '600' },

  // Glass Panel shared
  glassPanelOuter: { overflow: 'hidden', position: 'relative' },
  glassTopSheen: { position: 'absolute', top: 0, left: 0, right: 0, height: 48, zIndex: 0 },
  glassBottomGlow: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 56, zIndex: 0 },
  glassBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.16)',
  },

  // Today's Outfit Card
  outfitCard: { borderRadius: 24, overflow: 'hidden', position: 'relative' },
  outfitCardTopStrip: { position: 'absolute', top: 0, left: 0, right: 0, height: 80, zIndex: 0 },
  outfitCardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14, zIndex: 1,
  },
  outfitCardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  outfitCardTitleDot: { color: PRIMARY, fontSize: 8 },
  outfitCardTitle: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 0.2 },
  outfitCardDate: { color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '500', marginTop: 3 },
  regenBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,107,0,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,107,0,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  regenIcon: { color: PRIMARY, fontSize: 20, fontWeight: '700' },
  outfitDivider: {
    height: 1, backgroundColor: 'rgba(255,255,255,0.07)',
    marginHorizontal: 20, marginBottom: 8,
  },
  outfitItemsContainer: { paddingHorizontal: 16, paddingBottom: 4 },

  // Outfit Item Row
  outfitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  outfitRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  outfitRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  outfitEmojiBox: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  outfitEmoji: { fontSize: 22 },
  outfitLabel: {
    fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2,
  },
  outfitName: { color: '#fff', fontSize: 14, fontWeight: '700', flex: 1 },
  outfitColorDot: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    minWidth: 52,
  },
  outfitColorText: { fontSize: 10, fontWeight: '700', color: '#fff', textTransform: 'capitalize' },

  // Loading state
  outfitLoadingBox: { paddingVertical: 36, alignItems: 'center', gap: 12 },
  outfitLoadingIcon: { fontSize: 28, color: PRIMARY },
  outfitLoadingText: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '500' },

  // Outfit footer
  outfitFooter: { paddingHorizontal: 20, paddingVertical: 14, alignItems: 'center' },
  aiBadge: {
    backgroundColor: 'rgba(255,107,0,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,107,0,0.25)',
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5,
  },
  aiBadgeText: { color: PRIMARY, fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },

  // Week Strip
  weekRow: { gap: 8, paddingBottom: 8 },
  weekChip: {
    width: 48, height: 60, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  weekChipToday: {
    backgroundColor: 'rgba(255,107,0,0.12)',
    borderColor: 'rgba(255,107,0,0.4)',
  },
  weekChipDay: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  weekChipDate: { color: 'rgba(255,255,255,0.4)', fontSize: 16, fontWeight: '800' },

  // Feed
  card: { marginBottom: 36 },
  imageContainer: {
    aspectRatio: 3 / 4, borderRadius: 28, overflow: 'hidden',
    marginBottom: 16, position: 'relative',
  },
  cardImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  matchBadgeOuter: {
    position: 'absolute', top: 16, left: 16,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 999, overflow: 'hidden', paddingHorizontal: 12, paddingVertical: 6,
  },
  matchBadgeBorder: {
    ...StyleSheet.absoluteFillObject, borderRadius: 999,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.22)',
  },
  matchStar: { color: PRIMARY, fontSize: 13 },
  matchText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  expandBtnOuter: {
    position: 'absolute', bottom: 16, right: 16,
    width: 36, height: 36, borderRadius: 18,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
  },
  cardInfo: { paddingHorizontal: 8 },
  cardRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatarSmall: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  username: { color: '#fff', fontSize: 14, fontWeight: '700' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  actionBtn: { padding: 2 },
  caption: { color: 'rgba(255,255,255,0.65)', fontSize: 13, lineHeight: 20, fontWeight: '400' },
});