import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    FALLBACK_WARDROBE,
    GeneratedOutfit,
    getOrCreateDailyOutfit,
} from '../utils/outfitEngine';

const PRIMARY = '#FF6B00';
const BG = '#000000';
const CHARCOAL = '#1A1A1A';
const SOFT_GREY = '#262626';

const CATEGORIES = ['All', 'Tops', 'Bottoms', 'Outerwear', 'Shoes'];

const WARDROBE_ITEMS = [
  {
    id: '1',
    image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400&q=80',
    name: 'Oxford Shirt',
    category: 'Essential',
    tag: 'Linen',
  },
  {
    id: '2',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80',
    name: 'Studio Blazer',
    category: 'Outerwear',
    tag: 'Oversized',
  },
  {
    id: '3',
    image: 'https://images.unsplash.com/photo-1594938298603-c8148c4b4057?w=400&q=80',
    name: 'City Chinos',
    category: 'Bottoms',
    tag: 'Neutral',
  },
  {
    id: '4',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80',
    name: 'Chelsea Boots',
    category: 'Footwear',
    tag: 'Leather',
  },
  {
    id: '5',
    image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&q=80',
    name: 'Knit Pullover',
    category: 'Tops',
    tag: 'Cashmere',
  },
  {
    id: '6',
    image: 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=400&q=80',
    name: 'Heritage Jeans',
    category: 'Bottoms',
    tag: 'Denim',
  },
];

export default function WardrobeScreen() {
  const insets = useSafeAreaInsets();
  const [activeCategory, setActiveCategory] = useState(0);
  const [todayOutfit, setTodayOutfit] = useState<GeneratedOutfit | null>(null);

  useEffect(() => {
    getOrCreateDailyOutfit(FALLBACK_WARDROBE)
      .then((o) => setTodayOutfit(o))
      .catch(() => {});
  }, []);

  const filtered =
    activeCategory === 0
      ? WARDROBE_ITEMS
      : WARDROBE_ITEMS.filter(
          (item) =>
            item.category.toLowerCase() ===
            CATEGORIES[activeCategory].toLowerCase()
        );

  const leftCol = filtered.filter((_, i) => i % 2 === 0);
  const rightCol = filtered.filter((_, i) => i % 2 !== 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Image
              source={{
                uri: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&q=80',
              }}
              style={styles.avatar}
            />
            <View>
              <Text style={styles.headerTitle}>Virtual Wardrobe</Text>
              <Text style={styles.headerSub}>FITSENSE AI</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.searchBtn}>
            <Text style={{ color: '#fff', fontSize: 18 }}>⌕</Text>
          </TouchableOpacity>
        </View>

        {/* Category Filter */}
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
                style={[styles.chipText, activeCategory === i && styles.chipTextActive]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Today's Outfit Banner */}
      {todayOutfit && (
        <View style={styles.outfitBanner}>
          <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['rgba(255,107,0,0.12)', 'rgba(255,107,0,0.0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.outfitBannerBorder} />
          <View style={styles.outfitBannerLeft}>
            <Text style={styles.outfitBannerLabel}>✦ Today's Outfit</Text>
            <View style={styles.outfitBannerItems}>
              {[todayOutfit.top, todayOutfit.bottom, todayOutfit.footwear].map((item, i) => (
                <View key={i} style={styles.outfitBannerItem}>
                  <Text style={styles.outfitBannerEmoji}>{item.emoji}</Text>
                  <Text style={styles.outfitBannerName} numberOfLines={1}>{item.name}</Text>
                </View>
              ))}
            </View>
          </View>
          <Text style={styles.outfitBannerChevron}>›</Text>
        </View>
      )}

      {/* Grid */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.grid}>
          <View style={styles.column}>
            {leftCol.map((item) => (
              <WardrobeCard key={item.id} item={item} />
            ))}
          </View>
          <View style={styles.column}>
            {rightCol.map((item) => (
              <WardrobeCard key={item.id} item={item} />
            ))}
          </View>
        </View>
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

function WardrobeCard({ item }: { item: (typeof WARDROBE_ITEMS)[0] }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardImageWrapper}>
        <Image source={{ uri: item.image }} style={styles.cardImage} />
      </View>
      <View style={styles.cardInfo}>
        <View style={styles.tagRow}>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{item.tag}</Text>
          </View>
        </View>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemCategory}>{item.category}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    backgroundColor: 'rgba(0,0,0,0.88)',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  headerSub: {
    color: PRIMARY,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  searchBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  chipsRow: { gap: 8, paddingBottom: 8 },
  chip: {
    paddingHorizontal: 20, paddingVertical: 8,
    borderRadius: 999, backgroundColor: SOFT_GREY,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  chipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  chipText: {
    color: 'rgba(255,255,255,0.55)', fontSize: 11,
    fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1,
  },
  chipTextActive: { color: '#fff' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 140 },
  grid: { flexDirection: 'row', gap: 14 },
  column: { flex: 1, gap: 16 },
  card: { backgroundColor: CHARCOAL, borderRadius: 20, overflow: 'hidden' },
  cardImageWrapper: {
    aspectRatio: 3 / 4,
    backgroundColor: SOFT_GREY,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  cardImage: {
    width: '100%', height: '100%', resizeMode: 'cover', borderRadius: 12,
  },
  cardInfo: { padding: 12, gap: 4 },
  tagRow: { flexDirection: 'row' },
  tag: {
    backgroundColor: PRIMARY, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999,
  },
  tagText: { color: '#fff', fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  itemName: { color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 2 },
  itemCategory: { color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: '600' },
  fab: {
    position: 'absolute',
    bottom: 96,
    right: 20,
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: PRIMARY,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: PRIMARY, shadowRadius: 18, shadowOpacity: 0.55,
    shadowOffset: { width: 0, height: 4 },
    elevation: 14,
  },
  fabIcon: { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 32 },

  // Today's Outfit Banner
  outfitBanner: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 18,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    position: 'relative',
  },
  outfitBannerBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,107,0,0.25)',
  },
  outfitBannerLeft: { flex: 1 },
  outfitBannerLabel: {
    color: PRIMARY, fontSize: 11, fontWeight: '800',
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10,
  },
  outfitBannerItems: { flexDirection: 'row', gap: 12 },
  outfitBannerItem: { alignItems: 'center', gap: 4 },
  outfitBannerEmoji: { fontSize: 24 },
  outfitBannerName: {
    color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '600',
    maxWidth: 72, textAlign: 'center',
  },
  outfitBannerChevron: {
    color: 'rgba(255,255,255,0.35)', fontSize: 22, fontWeight: '300',
  },
});
