import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';

export default function ProfileHeader() {
  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Text style={styles.username}>Sanandsu</Text>

        <View style={styles.iconRow}>
          <TouchableOpacity>
            <Feather name="calendar" size={20} color="#aaa" />
          </TouchableOpacity>

          <TouchableOpacity>
            <Feather name="clock" size={20} color="#aaa" />
          </TouchableOpacity>

          <TouchableOpacity>
            <Feather name="menu" size={22} color="#aaa" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Profile Section */}
      <View style={styles.profileRow}>
        {/* Avatar */}
        <View style={styles.avatarWrapper}>
          <Image
            source={require('../../assets/img1.jpg')}
            style={styles.avatar}
          />
          <View style={styles.onlineIndicator} />
        </View>

        {/* Info */}
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>Sanandsu</Text>
          <Text style={styles.email}>sanandsu@gmail.com</Text>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>24</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>

            <View style={styles.statItem}>
              <Text style={styles.statNumber}>1.2k</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>

            <View style={styles.statItem}>
              <Text style={styles.statNumber}>320</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.primaryButton}>
          <Text style={styles.primaryText}>Edit Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton}>
          <Ionicons name="share-social-outline" size={18} color="#fff" />
          <Text style={styles.secondaryText}> Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
    paddingHorizontal: 24,
    paddingVertical: 30 ,
    borderBottomWidth: 1,
    borderBottomColor: '#111',
  },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },

  username: {
    color: '#de6161',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.6,
  },

  iconRow: {
    flexDirection: 'row',
    gap: 22,
  },

  profileRow: {
    flexDirection: 'row',
    marginBottom: 30,
  },

  avatarWrapper: {
    marginRight: 24,
  },

  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: '#222',
  },

  onlineIndicator: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#3b82f6',
    borderWidth: 3,
    borderColor: '#000',
  },

  name: {
    color: '#fff',
    fontSize: 24    ,
    fontWeight: '400',
  },

  email: {
    color: '#8b5f5f',
    fontSize: 14,
    marginTop: 6,
  },

  statsRow: {
    flexDirection: 'row',
    marginTop: 18,
  },

  statItem: {
    marginRight: 36,
  },

  statNumber: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 18,
  },

  statLabel: {
    color: '#777',
    fontSize: 13,
    marginTop: 4,
  },

  buttonRow: {
    flexDirection: 'row',
    gap: 16,
  },

  primaryButton: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },

  primaryText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 15,
  },

  secondaryButton: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },

  secondaryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
