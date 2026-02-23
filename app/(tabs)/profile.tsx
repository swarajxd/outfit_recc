import React, { useState } from 'react';
import {
  Dimensions,
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
const WIDTH = Dimensions.get('window').width;
const GRID_ITEM = (WIDTH - 2) / 3;

const POST_IMAGES = [
  'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=300&q=80',
  'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=300&q=80',
  'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=300&q=80',
  'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=300&q=80',
  'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=300&q=80',
  'https://images.unsplash.com/photo-1550614000-4895a10e1bfd?w=300&q=80',
  'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=300&q=80',
  'https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=300&q=80',
  'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=300&q=80',
];

const PROFILE_TABS = ['Posts', 'Saved', 'Wardrobe'];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState(0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity>
            <Text style={styles.topBarIcon}>⚙</Text>
          </TouchableOpacity>
          <Text style={styles.topBarHandle}>@alex_stylesense</Text>
          <TouchableOpacity>
            <Text style={styles.topBarIcon}>⬆</Text>
          </TouchableOpacity>
        </View>

        {/* Avatar */}
        <View style={styles.heroSection}>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatarGlow} />
            <View style={styles.avatarBorder}>
              <Image
                source={{
                  uri: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&q=80',
                }}
                style={styles.avatarImage}
              />
            </View>
            <View style={styles.verifiedBadge}>
              <Text style={{ color: '#000', fontSize: 10 }}>✓</Text>
            </View>
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>Alex Style-Sense</Text>
            <Text style={styles.profileRole}>Fashion Minimalist | AI Stylist</Text>
            <Text style={styles.profileBio}>
              Curating timeless aesthetics through data-driven precision.
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.editBtn}>
              <Text style={styles.editBtnText}>Edit Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.insightBtn}>
              <Text style={{ color: '#000', fontSize: 16 }}>📊</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>1.2k</Text>
            <Text style={styles.statLabel}>FOLLOWERS</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>850</Text>
            <Text style={styles.statLabel}>FOLLOWING</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <View style={styles.statValueRow}>
              <Text style={[styles.statValue, { color: PRIMARY }]}>92</Text>
              <Text style={styles.statPercent}>%</Text>
            </View>
            <Text style={styles.statLabel}>STYLE SENSE</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {PROFILE_TABS.map((tab, i) => (
            <TouchableOpacity
              key={tab}
              style={styles.tab}
              onPress={() => setActiveTab(i)}
            >
              <Text style={[styles.tabText, activeTab === i && styles.tabTextActive]}>
                {tab}
              </Text>
              {activeTab === i && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* Posts Grid */}
        <View style={styles.postsGrid}>
          {POST_IMAGES.map((uri, i) => (
            <TouchableOpacity key={i} style={styles.postItem}>
              <Image source={{ uri }} style={styles.postImage} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  topBarHandle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  topBarIcon: { color: '#fff', fontSize: 20 },
  heroSection: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  avatarWrapper: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  avatarGlow: {
    position: 'absolute',
    width: 136, height: 136, borderRadius: 68,
    backgroundColor: PRIMARY, opacity: 0.18,
    transform: [{ scale: 1.05 }],
  },
  avatarBorder: {
    width: 124, height: 124, borderRadius: 62,
    borderWidth: 3, borderColor: PRIMARY,
    padding: 4, overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%', borderRadius: 56 },
  verifiedBadge: {
    position: 'absolute', bottom: 4, right: 4,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: PRIMARY, borderWidth: 3, borderColor: BG,
    alignItems: 'center', justifyContent: 'center',
  },
  profileInfo: { alignItems: 'center', marginTop: 20, gap: 4 },
  profileName: { color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  profileRole: { color: PRIMARY, fontSize: 13, fontWeight: '600', marginTop: 2 },
  profileBio: {
    color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 20,
    textAlign: 'center', maxWidth: 240, marginTop: 8,
  },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 20, width: '100%' },
  editBtn: {
    flex: 1, borderWidth: 1.5, borderColor: PRIMARY,
    borderRadius: 999, paddingVertical: 12, alignItems: 'center',
  },
  editBtnText: { color: PRIMARY, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  insightBtn: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 32, paddingVertical: 20,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.015)',
  },
  statItem: { alignItems: 'center', flex: 1 },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  statValue: { color: '#fff', fontSize: 22, fontWeight: '800' },
  statPercent: { color: `${PRIMARY}99`, fontSize: 12, fontWeight: '800' },
  statLabel: {
    color: 'rgba(255,255,255,0.3)', fontSize: 9,
    fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 4,
  },
  statDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.08)' },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  tab: {
    flex: 1, alignItems: 'center', paddingVertical: 14,
    position: 'relative',
  },
  tabText: {
    color: 'rgba(255,255,255,0.35)', fontSize: 13, fontWeight: '700',
  },
  tabTextActive: { color: '#fff' },
  tabIndicator: {
    position: 'absolute', bottom: 0, left: '25%', right: '25%',
    height: 2, backgroundColor: PRIMARY, borderRadius: 99,
  },
  postsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    marginTop: 1,
  },
  postItem: {
    width: GRID_ITEM, height: GRID_ITEM,
    borderWidth: 0.5, borderColor: BG,
  },
  postImage: { width: '100%', height: '100%', resizeMode: 'cover' },
});
