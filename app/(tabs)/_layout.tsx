import { Tabs, useRouter } from 'expo-router';
import React from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PRIMARY = '#FF6B00';
const BG = '#000000';
const SURFACE = '#111111';
const INACTIVE = 'rgba(255,255,255,0.35)';

type TabRoute = 'home' | 'explore' | 'ai' | 'wardrobe' | 'profile';

interface TabItem {
  name: TabRoute;
  label: string;
  icon: string;
  iconFilled?: string;
}

const TABS: TabItem[] = [
  { name: 'home', label: 'Feed', icon: '⊞', iconFilled: '⊞' },
  { name: 'explore', label: 'Explore', icon: '◎', iconFilled: '◉' },
  { name: 'ai', label: 'AI', icon: '✦', iconFilled: '✦' },
  { name: 'wardrobe', label: 'Wardrobe', icon: '◫', iconFilled: '◫' },
  { name: 'profile', label: 'Profile', icon: '◯', iconFilled: '◉' },
];

type TabBarProps = {
  state: { index: number; routes: { name: string }[] };
  navigation: { navigate: (name: string) => void };
};

function CustomTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const currentRouteName = state.routes[state.index]?.name ?? '';

  return (
    <View style={[styles.tabBarWrapper, { paddingBottom: insets.bottom || 12 }]}>
      <View style={styles.tabBar}>
        {TABS.map((tab, idx) => {
          const isActive = currentRouteName === tab.name;
          const isCenter = tab.name === 'ai';

          if (isCenter) {
            return (
              <TouchableOpacity
                key={tab.name}
                onPress={() => router.push('/(tabs)/ai' as any)}
                style={styles.centerButtonWrapper}
                activeOpacity={0.85}
              >
                <View style={styles.centerButton}>
                  <Text style={styles.centerButtonIcon}>✦</Text>
                </View>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={tab.name}
              onPress={() => navigation.navigate(tab.name)}
              style={styles.tabItem}
              activeOpacity={0.7}
            >
              <TabIcon name={tab.name} isActive={isActive} />
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function TabIcon({ name, isActive }: { name: TabRoute; isActive: boolean }) {
  const color = isActive ? PRIMARY : INACTIVE;
  const size = 24;

  const icons: Record<TabRoute, { outline: string; filled: string }> = {
    home: { outline: '🏠', filled: '🏠' },
    explore: { outline: '🔍', filled: '🔍' },
    ai: { outline: '✦', filled: '✦' },
    wardrobe: { outline: '👔', filled: '👔' },
    profile: { outline: '👤', filled: '👤' },
  };

  // Use Expo vector icons style unicode emojis scaled correctly
  return (
    <View style={styles.iconContainer}>
      <TabSVGIcon name={name} isActive={isActive} size={size} />
    </View>
  );
}

function TabSVGIcon({
  name,
  isActive,
  size,
}: {
  name: TabRoute;
  isActive: boolean;
  size: number;
}) {
  const color = isActive ? PRIMARY : INACTIVE;

  const iconMap: Record<TabRoute, React.ReactNode> = {
    home: (
      <Text style={{ fontSize: size, color, lineHeight: size + 4 }}>⌂</Text>
    ),
    explore: (
      <Text style={{ fontSize: size - 2, color, lineHeight: size + 4 }}>⊕</Text>
    ),
    ai: (
      <Text style={{ fontSize: size, color, lineHeight: size + 4 }}>✦</Text>
    ),
    wardrobe: (
      <Text style={{ fontSize: size - 2, color, lineHeight: size + 4 }}>◈</Text>
    ),
    profile: (
      <Text style={{ fontSize: size - 2, color, lineHeight: size + 4 }}>◎</Text>
    ),
  };

  return <>{iconMap[name]}</>;
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...(props as any)} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="explore" />
      <Tabs.Screen name="ai" />
      <Tabs.Screen name="wardrobe" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarWrapper: {
    backgroundColor: 'rgba(0,0,0,0.92)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.5,
        shadowRadius: 12,
      },
      android: {
        elevation: 20,
      },
    }),
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: INACTIVE,
  },
  tabLabelActive: {
    color: PRIMARY,
  },
  centerButtonWrapper: {
    flex: 1,
    alignItems: 'center',
    marginBottom: 8,
  },
  centerButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    borderWidth: 3,
    borderColor: BG,
    ...Platform.select({
      ios: {
        shadowColor: PRIMARY,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 16,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  centerButtonIcon: {
    fontSize: 22,
    color: '#000',
    fontWeight: '900',
  },
});
