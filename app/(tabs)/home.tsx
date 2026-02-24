import React, { useState } from 'react';
import {
  Dimensions,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PRIMARY = '#FF6B00';
const BG = '#000000';
const SURFACE = '#121212';
const WIDTH = Dimensions.get('window').width;

const FEED_ITEMS = [
  {
    id: '1',
    image:
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80',
    matchPercent: 98,
    username: 'alexa_style',
    avatar:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&q=80',
    liked: true,
    caption:
      'Linen layers for the perfect summer afternoon. Minimalist, breathable, and timeless.',
    tag: '#QuietLuxury',
  },
  {
    id: '2',
    image:
      'https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=600&q=80',
    matchPercent: 82,
    username: 'marcus_fits',
    avatar:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80',
    liked: false,
    caption: 'Tokyo street style vibes. Oversized is the only way to go this season.',
    tag: '#StreetCore',
  },
  {
    id: '3',
    image:
      'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=600&q=80',
    matchPercent: 90,
    username: 'zoe.fits',
    avatar:
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&q=80',
    liked: false,
    caption: 'Monochrome palette, maximum impact. The art of wearing nothing but black.',
    tag: '#Monochrome',
  },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'foryou' | 'following'>('foryou');
  const [likedItems, setLikedItems] = useState<Record<string, boolean>>({
    '1': true,
  });

  const toggleLike = (id: string) => {
    setLikedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Sticky Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          {/* Search */}
          <View style={styles.searchWrapper}>
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search trends..."
              placeholderTextColor="rgba(255,255,255,0.3)"
            />
          </View>
          {/* Avatar */}
          <Image
            source={{
              uri: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&q=80',
            }}
            style={styles.userAvatar}
          />
        </View>

        {/* For You / Following Toggle */}
        <View style={styles.toggleRow}>
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                activeTab === 'foryou' && styles.toggleBtnActive,
              ]}
              onPress={() => setActiveTab('foryou')}
            >
              <Text
                style={[
                  styles.toggleText,
                  activeTab === 'foryou' && styles.toggleTextActive,
                ]}
              >
                For You
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                activeTab === 'following' && styles.toggleBtnActive,
              ]}
              onPress={() => setActiveTab('following')}
            >
              <Text
                style={[
                  styles.toggleText,
                  activeTab === 'following' && styles.toggleTextActive,
                ]}
              >
                Following
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Feed */}
      <ScrollView
        style={styles.feed}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {FEED_ITEMS.map((item) => (
          <FeedCard
            key={item.id}
            item={item}
            liked={!!likedItems[item.id]}
            onLike={() => toggleLike(item.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function FeedCard({
  item,
  liked,
  onLike,
}: {
  item: (typeof FEED_ITEMS)[0];
  liked: boolean;
  onLike: () => void;
}) {
  return (
    <View style={styles.card}>
      {/* Outfit Image */}
      <View style={styles.imageContainer}>
        <Image source={{ uri: item.image }} style={styles.cardImage} />

        {/* Sense Match Badge */}
        <View style={styles.matchBadge}>
          <Text style={styles.matchStar}>✦</Text>
          <Text style={styles.matchText}>
            Sense Match:{' '}
            <Text style={{ color: PRIMARY }}>{item.matchPercent}%</Text>
          </Text>
        </View>

        {/* Expand button */}
        <TouchableOpacity style={styles.expandBtn}>
          <Text style={{ color: '#fff', fontSize: 16 }}>⛶</Text>
        </TouchableOpacity>
      </View>

      {/* Card Info */}
      <View style={styles.cardInfo}>
        <View style={styles.cardRow}>
          {/* User */}
          <View style={styles.userRow}>
            <Image source={{ uri: item.avatar }} style={styles.avatarSmall} />
            <Text style={styles.username}>{item.username}</Text>
          </View>
          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity onPress={onLike} style={styles.actionBtn}>
              <Text style={{ fontSize: 22, color: liked ? PRIMARY : 'rgba(255,255,255,0.8)' }}>
                {liked ? '♥' : '♡'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn}>
              <Text style={{ fontSize: 20, color: 'rgba(255,255,255,0.8)' }}>💬</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn}>
              <Text style={{ fontSize: 20, color: 'rgba(255,255,255,0.8)' }}>🔖</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.caption}>
          {item.caption}{' '}
          <Text style={{ color: `${PRIMARY}cc` }}>{item.tag}</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  searchWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchIcon: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 18,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    padding: 0,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  toggleRow: {
    alignItems: 'center',
    marginBottom: 8,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999,
    padding: 4,
    width: 220,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: '#fff',
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  toggleTextActive: {
    color: '#000',
    fontWeight: '700',
  },
  feed: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  card: {
    marginBottom: 36,
  },
  imageContainer: {
    aspectRatio: 3 / 4,
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 16,
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  matchBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  matchStar: {
    color: PRIMARY,
    fontSize: 13,
  },
  matchText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  expandBtn: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cardInfo: {
    paddingHorizontal: 8,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  username: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  actionBtn: {
    padding: 2,
  },
  caption: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '400',
  },
});
