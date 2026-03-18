import React, { useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
});
