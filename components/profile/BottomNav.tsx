import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';

interface Props {
  active?: 'home' | 'profile';
}

export default function BottomNav({ active = 'profile' }: Props) {
  return (
    <View style={styles.container}>
      {/* Home */}
      <TouchableOpacity style={styles.iconWrapper}>
        <Feather
          name="home"
          size={24}
          color={active === 'home' ? '#fff' : '#777'}
        />
      </TouchableOpacity>

      {/* Center Add Button */}
      <View style={styles.fabWrapper}>
        <TouchableOpacity style={styles.fab}>
          <Feather name="plus" size={28} color="#000" />
        </TouchableOpacity>
      </View>

      {/* Profile */}
      <TouchableOpacity style={styles.iconWrapper}>
        <Ionicons
          name={active === 'profile' ? 'person' : 'person-outline'}
          size={24}
          color={active === 'profile' ? '#fff' : '#777'}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 14,
  },

  iconWrapper: {
    flex: 1,
    alignItems: 'center',
  },

  fabWrapper: {
    position: 'relative',
    top: -24,
  },

  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',

    // Shadow (iOS)
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,

    // Elevation (Android)
    elevation: 8,
  },
});
