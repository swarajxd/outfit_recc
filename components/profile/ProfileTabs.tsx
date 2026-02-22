import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';

interface ProfileTabsProps {
  activeTab: 'posts' | 'wardrobe' | 'outfits' | 'saved';
  setActiveTab: (tab: 'posts' | 'wardrobe' | 'outfits' | 'saved') => void;
}

const TABS = [
  { id: 'posts', label: 'Posts' },
  { id: 'wardrobe', label: 'Wardrobe' },
  { id: 'outfits', label: 'Outfits' },
  { id: 'saved', label: 'Saved' },
];

export default function ProfileTabs({
  activeTab,
  setActiveTab,
}: ProfileTabsProps) {
  const underlineX = useRef(new Animated.Value(0)).current;
  const tabWidth = Dimensions.get('window').width / TABS.length;

  useEffect(() => {
    const index = TABS.findIndex((t) => t.id === activeTab);

    Animated.spring(underlineX, {
      toValue: index * tabWidth,
      useNativeDriver: false,
      speed: 20,
      bounciness: 6,
    }).start();
  }, [activeTab]);

  return (
    <View style={styles.container}>
      <View style={styles.tabRow}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={styles.tabButton}
            activeOpacity={0.7}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab.id && styles.activeText,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Animated Underline */}
      <Animated.View
        style={[
          styles.underline,
          {
            width: tabWidth,
            transform: [{ translateX: underlineX }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    borderBottomColor: '#111',
  },

  tabRow: {
    flexDirection: 'row',
  },

  tabButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },

  tabText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },

  activeText: {
    color: '#fff',
    fontWeight: '700',
  },

  underline: {
    height: 3,
    backgroundColor: '#fff',
  },
});
